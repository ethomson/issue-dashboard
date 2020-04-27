// A configuration is an `Analytics` structure of its own.  It will take
// the YAML configuration and parse it into an `AnalyticsConfig`.  This
// will contain the literal definition from the configuration itself.
// By running the `evaluate` on the `Analytics`, it will take the input,
// including any queries, and execute them to produce a static `Analytics`
// structure with the actual values.

import { QueryType, Analytics, Section, Widget, GraphWidget, TableWidget, QueryTableWidget, NumberWidget, QueryNumberWidget, ScriptNumberWidget, StringWidget, ScriptStringWidget } from './analytics'

import * as yaml from 'js-yaml'

export interface OutputConfig {
    format: string
}

function configError(context: string | null, message: string): never {
    const location = context ? ` for ${context}` : ''
    throw new Error(`config: invalid configuration${location}: ${message}`)
}

function configValue(config: any, context: string | null, key: string, required: boolean = false): any {
    if (!(key in config) && required) {
        configError(context, `missing required option '${key}'`)
    }

    let value = config[key]
    delete config[key]

    return value
}

function ensureConfigEmpty(config: any, context: string | null) {
    var remaining = Object.keys(config)

    if (remaining.length != 0) {
        configError(context, `unexpected option '${remaining[0]}'`)
    }
}

function keyList(keys: string[], andor: string) {
    let result: string[] = new Array()

    for (let i = 0; i < keys.length; i++) {
        if (i == keys.length - 1) {
            result.push(` ${andor} `)
        }
        else if (i > 0) {
            result.push(', ')
        }

        result.push(`'${keys[i]}'`)
    }

    return result.join('')
}

function ensureOneConfigKey(config: any, context: string | null, keys: string[]) {
    let found: string[] = new Array()

    for (let key of keys) {
        if (key in config) {
            found.push(key)
        }
    }

    if (found.length == 0) {
        configError(context, `expected one of: ${keyList(keys, 'or')}`)
    }

    if (found.length > 1) {
        configError(context, `expected only one of: ${keyList(found, 'or')}`)
    }
}

export class AnalyticsConfig extends Analytics {
    public readonly output: OutputConfig

    private constructor(title: string, description: string, sections: Section[], output: OutputConfig, setup: string, shutdown: string) {
        super(title, description, sections, setup, shutdown)

        this.output = output
    }

    private static loadStringWidget(config: any): Widget {
        let widget: Widget

        if (typeof config == 'string') {
            config = { value: config }
        }

        ensureOneConfigKey(config, 'string widget', [ 'value', 'script' ])

        let title = configValue(config, 'string widget', 'title')
        let url = configValue(config, 'string widget', 'url')
        let color = configValue(config, 'string widget', 'color')
        let align = configValue(config, 'string widget', 'align')
        let value = configValue(config, 'string widget', 'value')
        let script = configValue(config, 'string widget', 'script')

        if (script != null) {
            widget = new ScriptStringWidget(title, url, script, align, color)
        }
        else if (value != null) {
            widget = new StringWidget(title, url, value, align, color)
        }
        else {
            throw new Error()
        }

        ensureConfigEmpty(config, 'string widget')
        return widget
    }

    private static loadNumberWidget(config: any): Widget {
        let widget: Widget

        ensureOneConfigKey(config, 'number widget', [ 'issue_query', 'value', 'script' ])

        let title = configValue(config, 'number widget', 'title')
        let url = configValue(config, 'number widget', 'url')
        let color = configValue(config, 'number widget', 'color')
        let value = configValue(config, 'number widget', 'value')
        let script = configValue(config, 'number widget', 'script')

        let query = configValue(config, 'number widget', 'issue_query')
        let query_type = QueryType.Issue

        if (query != null) {
            widget = new QueryNumberWidget(title, url, query_type, query, color)
        }
        else if (script != null) {
            widget = new ScriptNumberWidget(title, url, script, color)
        }
        else if (value != null) {
            widget = new NumberWidget(title, url, value, color)
        }
        else {
            throw new Error()
        }

        ensureConfigEmpty(config, 'number widget')
        return widget
    }

    private static loadGraphWidget(config: any): Widget {
        let widgets: Widget[] = new Array()

        let title = configValue(config, 'graph widget', 'title')
        let url = configValue(config, 'graph widget', 'url')
        let elements = configValue(config, 'graph widget', 'elements', true)

        for (let element of elements) {
            ensureOneConfigKey(element, 'graph widget element', [ 'issue_query', 'value' ])

            let title = configValue(element, 'graph widget element', 'title')
            let url = configValue(element, 'graph widget element', 'url')
            let color = configValue(element, 'graph widget element', 'color')

            let query = configValue(element, 'graph widget element', 'issue_query')
            let query_type = QueryType.Issue

            let value = configValue(element, 'graph widget element', 'value')

            if (query != null) {
                widgets.push(new QueryNumberWidget(title, url, query_type, query, color))
            }
            else if (value != null) {
                widgets.push(new NumberWidget(title, url, value, color))
            }

            ensureConfigEmpty(element, 'graph widget element')
        }

        ensureConfigEmpty(config, 'graph widget')
        return new GraphWidget(title, url, widgets)
    }

    private static loadQueryTableWidget(config: any): Widget {
        let title = configValue(config, 'table widget', 'title')
        let url = configValue(config, 'table widget', 'url')
        let fields = configValue(config, 'table widget', 'fields')

        let query = configValue(config, 'table widget', 'issue_query', true)
        let limit = configValue(config, 'table widget', 'limit')
        let query_type = QueryType.Issue

        if (fields != null && !Array.isArray(fields)) {
            configError('table widget', `'fields' is not an array`)
        }

        return new QueryTableWidget(title, url, query_type, query, limit, fields)
    }

    private static loadStaticTableWidget(config: any): Widget {
        const headers: Widget[] = new Array()
        const elements: Widget[][] = new Array()

        let title = configValue(config, 'table widget', 'title')
        let url = configValue(config, 'table widget', 'url')
        let headerConfig = configValue(config, 'table widget', 'headers')
        let elementsConfig = configValue(config, 'table widget', 'elements', true)

        if (headerConfig != null && Array.isArray(headerConfig)) {
            for (let header of headerConfig) {
                headers.push(AnalyticsConfig.loadStringWidget(header))
            }
        }
        else if (headerConfig != null) {
            headers.push(AnalyticsConfig.loadStringWidget(headerConfig))
        }

        if (elementsConfig != null && !Array.isArray(elementsConfig)) {
            configError('table widget', `'elements' is not an array`)
        }

        for (let elementList of elementsConfig) {
            if (Array.isArray(elementList)) {
                let row: Widget[] = new Array()

                for (let element of elementList) {
                    row.push(AnalyticsConfig.loadStringWidget(element))
                }

                elements.push(row)
            }
            else {
                elements.push([ AnalyticsConfig.loadStringWidget(elementList) ])
            }
        }

        return new TableWidget(title, url, headers, elements)
    }

    private static loadTableWidget(config: any): Widget {
        let widget: Widget

        ensureOneConfigKey(config, 'table widget', [ 'issue_query', 'elements' ])
        
        if (config.issue_query != null) {
            widget = AnalyticsConfig.loadQueryTableWidget(config)
        }
        else {
            widget = AnalyticsConfig.loadStaticTableWidget(config)
        }

        ensureConfigEmpty(config, 'table widget')
        return widget
    }

    private static loadWidget(config: any): Widget {
        let widget: Widget
        let type = configValue(config, 'widget', 'type', true)

        if (type == 'number') {
            widget = AnalyticsConfig.loadNumberWidget(config)
        }
        else if (type == 'string') {
            widget = AnalyticsConfig.loadStringWidget(config)
        }
        else if (type == 'graph') {
            widget = AnalyticsConfig.loadGraphWidget(config)
        }
        else if (type == 'table') {
            widget = AnalyticsConfig.loadTableWidget(config)
        }
        else {
            configError('widget', `invalid type '${type}'`)
        }

        ensureConfigEmpty(config, 'widget')
        return widget
    }
    
    private static loadSection(config: any): Section {
        const widgets: Widget[] = new Array()

        let title = configValue(config, 'section', 'title')
        let description = configValue(config, 'section', 'description')
        let widgetConfig = configValue(config, 'section', 'widgets')
    
        if (widgetConfig != null) {
            if (!Array.isArray(widgetConfig)) {
                configError('section', `'widgets' is not an array`)
            }
    
            for (let wc of widgetConfig) {
                widgets.push(AnalyticsConfig.loadWidget(wc))
            }
        }
    
        ensureConfigEmpty(config, 'section')
        return new Section(title, description, widgets)
    }

    private static loadOutput(config: any): OutputConfig {
        let output: any = { }

        if (!('format' in config)) {
            throw new Error(`config: 'output.format' is not defined`)
        }

        for (let key in config) {
            output[key] = config[key]
        }

        return output as OutputConfig
    }
    
    private static load(config: any): AnalyticsConfig {
        const sections: Section[] = new Array()

        let title = configValue(config, null, 'title')
        let description = configValue(config, null, 'description')
        let setup = configValue(config, null, 'setup')
        let shutdown = configValue(config, null, 'shutdown')
        let outputConfig = configValue(config, null, 'output', true)
        let sectionConfig = configValue(config, null, 'sections')
    
        if (sectionConfig != null) {
            if (!Array.isArray(sectionConfig)) {
                configError(null, `'sections' is not an array`)
            }
    
            for (let section of sectionConfig) {
                sections.push(AnalyticsConfig.loadSection(section))
            }
        }

        let output = AnalyticsConfig.loadOutput(outputConfig)

        ensureConfigEmpty(config, null)
        return new AnalyticsConfig(title, description, sections, output, setup, shutdown)
    }

    public static fromJson(config: string): AnalyticsConfig {
        return AnalyticsConfig.load(JSON.parse(config))
    }
    
    public static fromYaml(config: string): AnalyticsConfig {
        return AnalyticsConfig.load(yaml.safeLoad(config))
    }

    public static from(config: string): AnalyticsConfig {
        enum ConfigFormat { JSON, YAML }
        let format: ConfigFormat
        let input: any

        try {
            input = JSON.parse(config)
            format = ConfigFormat.JSON
        }
        catch (e) {
            input = yaml.safeLoad(config)
            format = ConfigFormat.YAML
        }

        if (format == ConfigFormat.JSON) {
            return AnalyticsConfig.load(input)
        }
        else {
            return AnalyticsConfig.load(input)
        }
    }
}
