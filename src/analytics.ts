// The data structure that contains the actual analytics information.
// An analytics data structure contains one or more "sections" that
// are available for grouping.  Sections contain one or more "widgets"
// that show data.  For example, the `NumberWidget` shows a number, the
// `GraphWidget` shows a graph.
//
// Some of these widgets are able to be computed from dynamic data:
// for example, the `QueryNumberWidget` can execute a query against the
// items REST endpoint on GitHub.
//
// Each widget has an `evaluate` function; this will run its query,
// capture the output, and then return a static value widget with the
// data.  That is, running `QueryNumberWidget.evaluate` will return a
// `NumberWidget` with the actual value set.  The renderers expect static
// value widgets (the results of `evaluate`).

import { AnalyticsConfig } from './config'
import { Evaluate } from './evaluate'
import { GitHub } from '@actions/github'
import * as yaml from 'js-yaml'

interface EvaluationContext {
    github: GitHub,
    querycache?: { [key: string]: QueryCacheItem },
    item?: { [key: string]: any },
    value?: string | number,
    userdata: { }
}

export const enum QueryType {
    Issue
}

interface QueryResults {
    totalCount: number,
    items: { [key: string]: any }[],
    url: string
}

interface QueryCacheItem {
    query: string,
    totalCount: number,
    items: { [key: string]: any }[]
}

async function evaluateExpression(expr: string | null, context: EvaluationContext): Promise<string | null> {
    return expr != null ? await Evaluate.parseExpression(expr, context) : null
}

async function evaluateMetadata(md: string | null, context: EvaluationContext, value: string | number): Promise<string | null> {
    if (md == null) {
        return null
    }

    const valuedContext: EvaluationContext = {
        github: context.github,
        value: value,
        userdata: context.userdata
    }

    return await Evaluate.parseExpression(md, valuedContext)
}

async function evaluateQuery(type: QueryType, query: string, limit: number, context: EvaluationContext) {
    // fetch 100 at a time (the GitHub REST API limit) for maximum caching
    const FETCH_COUNT = 100

    let queryFunction: Function
    let resultCount = -1
    let totalCount = 2147483647
    let items = new Array()
    let page = 0

    if (type == QueryType.Issue) {
        queryFunction = context.github.search.issuesAndPullRequests
    } else {
        throw new Error(`unknown query type: ${type}`)
    }

    let parsedQuery = await Evaluate.parseExpression(query, context)
    let url = queryToUrl(parsedQuery)

    // start with any data that we've cached for this query.  we may need
    // to fetch additional pages to supply the requested number of items
    if (context.querycache != null && context.querycache[parsedQuery] != null) {
        const cached = context.querycache[parsedQuery]
        totalCount = cached.totalCount
        items = cached.items
        resultCount = items.length
        page = items.length / FETCH_COUNT
    }

    while (resultCount < limit && resultCount < totalCount) {
        let results = await queryFunction({
            q: parsedQuery,
            per_page: FETCH_COUNT,
            page: ++page
        })

        totalCount = results.data.total_count
        resultCount += results.data.items.length
        items.push(...results.data.items)

        if (results.data.items.length == 0) {
            break
        }
    }

    if (context.querycache != null) {
        context.querycache[parsedQuery] = {
            query: parsedQuery,
            totalCount: totalCount,
            items: items
        }
    }

    return {
        totalCount: totalCount,
        items: items.slice(0, limit),
        url: url
    }
}

export function queryToUrl(query: string): string {
    let repo: string | null = null

    query = query.replace(/^(.*\s+)?repo:([^\s]+)(\s+.*)?$/, (match: string, ...args: any[]): string => {
        repo = args[1]

        let replace = ''
        if (args[0] != null) { replace += args[0] } 
        if (args[2] != null) { replace += args[2] } 
        return replace
    })

    query = query.replace(/\s+/g, ' ').replace(/^ /, '').replace(/ $/, '')

    return repo ?
        `https://github.com/${repo}/issues?q=${encodeURIComponent(query)}` :
        `https://github.com/search?q=${encodeURIComponent(query)}`
}

export abstract class Widget {
    public readonly title: string | null
    public readonly url: string | null

    constructor(title: string | null, url: string | null) {
        this.title = title
        this.url = url
    }

    abstract async evaluate(context: EvaluationContext): Promise<Widget>
}

// A widget that has an expression that will evaluate to a numeric value
export class NumberWidget extends Widget {
    public readonly value: string | number
    public readonly color: string | null

    constructor(title: string | null, url: string | null, value: string | number, color: string | null) {
        super(title, url)
        this.value = value
        this.color = color
    }

    public async evaluate(context: EvaluationContext): Promise<Widget> {
        let value:number

        if (typeof(this.value) == 'number') {
            value = this.value as number
        } else {
            let result = await Evaluate.parseExpression(this.value, context)

            if (typeof(result) == 'number') {
                value = result as number
            }
            else {
                value = +result
            }
        }

        const title = await evaluateMetadata(this.title, context, value)
        const url = await evaluateMetadata(this.url, context, value)
        const color = await evaluateMetadata(this.color, context, value)

        return new NumberWidget(title, url, value, color)
    }
}

// A widget that runs an issue query and displays the number of returned
// items as a numeric value
export class QueryNumberWidget extends Widget {
    private readonly type: QueryType
    private readonly query: string
    public readonly color: string | null

    constructor(title: string | null, url: string | null, type: QueryType, query: string, color: any) {
        super(title, url)
        this.type = type
        this.query = query
        this.color = color
    }

    public async evaluate(context: EvaluationContext): Promise<Widget> {
        let results = await evaluateQuery(this.type, this.query, 0, context)

        const value = results.totalCount
        const url = this.url != null ? await evaluateMetadata(this.url, context, value) : results.url
        const title = await evaluateMetadata(this.title, context, value)
        const color = await evaluateMetadata(this.color, context, value)

        return new NumberWidget(title, url, value, color)
    }
}

// A widget that runs a script and displays the number of returned
// items as a numeric value
export class ScriptNumberWidget extends Widget {
    private readonly script: string
    public readonly color: string | null

    constructor(title: string | null, url: string | null, script: string, color: string | null) {
        super(title, url)
        this.script = script
        this.color = color
    }

    public async evaluate(context: EvaluationContext): Promise<Widget> {
        let result:any = await Evaluate.runScript(this.script, context)
        let value:number

        let title: string | null = null
        let url: string | null = null
        let color: string | null = null

        if (typeof result == 'object' && result.value) {
            title = result.title
            url = result.url
            color = result.color
            result = result.value
        }

        if (typeof result != 'number') {
            result = result.toString()

            if (result.match(/^\d+$/)) {
                result = +result
            }
            else {
                result = Number.NaN
            }
        }

        value = result as number

        if (title == null) {
            title = await evaluateMetadata(this.title, context, value)
        }

        if (url == null) {
            url = await evaluateMetadata(this.url, context, value)
        }

        if (color == null) {
            color = await evaluateMetadata(this.color, context, value)
        }

        return new NumberWidget(title, url, result, color)
    }
}

// A widget that has an expression that will evaluate to a string value
export class StringWidget extends Widget {
    public readonly value: string
    public readonly align: string | null
    public readonly color: string | null

    constructor(title: string | null, url: string | null, value: string, align: string | null, color: string | null) {
        super(title, url)
        this.value = value
        this.align = align
        this.color = color
    }

    public async evaluate(context: EvaluationContext): Promise<Widget> {
        let value = await Evaluate.parseExpression(this.value, context)

        const title = await evaluateMetadata(this.title, context, value)
        const url = await evaluateMetadata(this.url, context, value)
        const align = await evaluateMetadata(this.align, context, value)
        const color = await evaluateMetadata(this.color, context, value)

        return new StringWidget(title, url, value, align, color)
    }
}

// A widget that runs a script and displays the string returned
export class ScriptStringWidget extends Widget {
    private readonly script: string
    public readonly align: string | null
    public readonly color: string | null

    constructor(title: string | null, url: string | null, script: string, align: string | null, color: string | null) {
        super(title, url)
        this.script = script
        this.align = align
        this.color = color
    }

    public async evaluate(context: EvaluationContext): Promise<Widget> {
        let result:any = await Evaluate.runScript(this.script, context)
        let value:string

        let title: string | null = null
        let url: string | null = null
        let align: string | null = null
        let color: string | null = null

        if (typeof result == 'object' && result.value) {
            title = result.title
            url = result.url
            color = result.color
            result = result.value
        }

        if (typeof result != 'string') {
            result = result.toString()
        }

        value = result

        if (title == null) {
            title = await evaluateMetadata(this.title, context, value)
        }

        if (url == null) {
            url = await evaluateMetadata(this.url, context, value)
        }

        if (align == null) {
            align = await evaluateMetadata(this.align, context, value)
        }

        if (color == null) {
            color = await evaluateMetadata(this.color, context, value)
        }

        return new StringWidget(title, url, result, align, color)
    }
}

// A widget that displays multiple numeric values against each other,
// usually in a bar graph.  This actually is composed of other widgets;
// namely `NumberWidget`s (or things that derive from it, like a
// `QueryNumberWidget`s) to store the data.
export class GraphWidget extends Widget {
    public readonly elements: Widget[]

    constructor(title: string | null, url: string | null, elements: Widget[] | null) {
        super(title, url)
        this.elements = elements ? elements : new Array()
    }

    public async evaluate(context: EvaluationContext): Promise<Widget> {
        let elements: NumberWidget[] = new Array()

        for (let element of this.elements) {
            let result = await element.evaluate(context)

            if (! (result instanceof NumberWidget)) {
                throw new Error('graph widget elements must be number widgets')
            }

            elements.push(result)
        }

        const title = await evaluateExpression(this.title, context)
        const url = await evaluateExpression(this.url, context)

        return new GraphWidget(title, url, elements)
    }
}

export class TableWidget extends Widget {
    public readonly headers: Widget[]
    public readonly elements: Widget[][]

    constructor(title: string | null, url: string | null, headers: Widget[], elements: Widget[][]) {
        super(title, url)

        this.headers = headers
        this.elements = elements
    }

    public async evaluate(context: EvaluationContext): Promise<Widget> {
        let headers: (StringWidget | NumberWidget)[] = new Array()
        let elements: (StringWidget | NumberWidget)[][] = new Array()

        for (let header of this.headers) {
            let result = await header.evaluate(context)

            if (! (result instanceof NumberWidget) && ! (result instanceof StringWidget)) {
                throw new Error('table widget elements must be string or number widgets')
            }

            headers.push(result)
        }

        for (let row of this.elements) {
            let cells: (StringWidget | NumberWidget)[] = new Array()

            for (let cell of row) {
                let result = await cell.evaluate(context)

                if (! (result instanceof NumberWidget) && ! (result instanceof StringWidget)) {
                    throw new Error('table widget elements must be string or number widgets')
                }

                cells.push(result)
            }

            elements.push(cells)
        }

        const title = await evaluateExpression(this.title, context)
        const url = await evaluateExpression(this.url, context)

        return new TableWidget(title, url, headers, elements)
    }
}

export interface QueryTableWidgetFields {
    title?: string,
    property?: string,
    value?: string
}

export class QueryTableWidget extends Widget {
    private readonly type: QueryType
    private readonly query: string
    private readonly limit: number
    private readonly fields: QueryTableWidgetFields[]

    private static readonly DEFAULT_FIELDS = {
        [QueryType.Issue]: [
            { title: 'Issue', property: 'number' },
            { title: 'Title', property: 'title' }
        ]
    }

    private static readonly DEFAULT_LIMIT = 10

    constructor(title: string | null, url: string | null, type: QueryType, query: string, limit: number | null, fields: QueryTableWidgetFields[] | null) {
        super(title, url)
        this.type = type
        this.query = query
        this.limit = limit != null ? limit : QueryTableWidget.DEFAULT_LIMIT
        this.fields = fields != null ? fields : QueryTableWidget.DEFAULT_FIELDS[type]
    }

    private getHeaders(): string[] {
        const headers: string[] = new Array()

        for (let field of this.fields) {
            if (field.title != null) {
                headers.push(field.title)
            }
            else if (field.value != null) {
                headers.push(field.value)
            }
            else {
                headers.push(field.toString())
            }
        }

        return headers
    }

    private static async evaluateItemValue(value: string, context: EvaluationContext, item: { [key: string]: any }): Promise<string> {
        const valuedContext: EvaluationContext = {
            github: context.github,
            item: item,
            userdata: context.userdata
        }

        return await Evaluate.parseExpression(value, valuedContext)
    }

    private async getRow(item: { [key: string]: any }, context: EvaluationContext): Promise<string[]> {
        const values: string[] = new Array()

        for (let field of this.fields) {
            if (field.value != null) {
                values.push(await QueryTableWidget.evaluateItemValue(field.value, context, item))
            }
            else {
                let property = (field.property != null) ? field.property : field.toString()
                values.push(item[property])
            }
        }

        return values
    }

    public async evaluate(context: EvaluationContext): Promise<Widget> {
        let headers: Widget[] = new Array()
        let elements: Widget[][] = new Array()

        let results = await evaluateQuery(this.type, this.query, this.limit, context)

        for (let header of this.getHeaders()) {
            headers.push(new StringWidget(null, null, header, null, null))
        }

        let item: { [key: string]: any }
        for (item of results.items) {
            let row: Widget[] = new Array()

            for (let value of await this.getRow(item, context)) {
                row.push(new StringWidget(null, item.html_url, value, null, null))
            }

            elements.push(row)
        }

        const title = await evaluateExpression(this.title, context)
        const url = this.url != null ?  await evaluateExpression(this.url, context) : results.url

        return new TableWidget(title, url, headers, elements)
    }
}

// A `Section` contains one or more widgets
export class Section {
    public readonly title: string | null
    public readonly description: string | null
    public readonly widgets: readonly Widget[]

    constructor(title: string | null, description: string | null, widgets: Widget[]) {
        this.title = title
        this.description = description
        this.widgets = widgets
    }

    public async evaluate(context: EvaluationContext): Promise<Section> {
        const evaluated: Widget[] = new Array()

        for (let widget of this.widgets) {
            evaluated.push(await widget.evaluate(context))
        }

        const title = this.title ? await Evaluate.parseExpression(this.title, context) : null
        const description = this.description ? await Evaluate.parseExpression(this.description, context) : null

        return new Section(title, description, evaluated)
    }
}

export class Analytics {
    public readonly title: string | null
    public readonly description: string | null
    public readonly sections: readonly Section[]

    private readonly setup: string | null
    private readonly shutdown: string | null

    protected constructor(title: string | null, description: string | null, sections: Section[], setup: string | null, shutdown: string | null) {
        this.title = title
        this.description = description
        this.sections = sections

        this.setup = setup
        this.shutdown = shutdown
    }

    public static async evaluate(config: AnalyticsConfig, github: GitHub): Promise<Analytics> {
        const context = { 'github': github, 'querycache': { }, 'userdata': { } }
        const evaluated: Section[] = new Array()

        if (config.setup != null) {
            await Evaluate.runScript(config.setup, context)
        }

        for (let section of config.sections) {
            evaluated.push(await section.evaluate(context))
        }

        const title = await evaluateExpression(config.title, context)
        const description = await evaluateExpression(config.description, context)

        if (config.shutdown != null) {
            await Evaluate.runScript(config.shutdown, context)
        }

        return new Analytics(title, description, evaluated, null, null)
    }
}
