// An HTML renderer takes an `Analytics` structure and emits the output
// as HTML.

import { Analytics, Section, Widget, NumberWidget, StringWidget, GraphWidget, TableWidget } from './analytics'
import { AnalyticsConfig } from './config'
import * as fs from 'fs'

interface HtmlConfig {
    format: string
    filename: string
}

function createAnchor(title: string) {
    return title.replace(/ /g, '-').replace(/[^A-Za-z0-9_\-]/g, '').toLowerCase()
}
    
export class HtmlRenderer {
    private readonly config: HtmlConfig

    public constructor(config: AnalyticsConfig) {
        if (config == null || config.output == null) {
            throw new Error('invalid configuration for html renderer')
        }

        let htmlconfig = config.output as HtmlConfig

        if (htmlconfig.format == null || htmlconfig.format != 'html') {
            throw new Error(`config: 'output.format' expected as 'html'`)
        }

        if (htmlconfig.filename == null) {
            throw new Error(`config: 'output.filename' is not defined`)
        }

        this.config = htmlconfig
    }

    private static renderStartNumberWidgets(): string {
        return `<div class="number_widgets">`
    }

    private static renderFinishNumberWidgets(): string {
        return `</div> <!-- number_widgets -->`
    }

    private static renderNumberWidget(widget: NumberWidget): string {
        let out: string[] = new Array()

        if (widget.title != null) {
            out.push(`<a name="${createAnchor(widget.title)}"></a>`)
        }

        if (widget.url != null) {
            out.push(`<a href="${widget.url}">`)
        }

        out.push(`<div class="number_widget${widget.color ? ' ' + widget.color : ''}">`)

        if (widget.title != null) {
            out.push(`<span class="title">${widget.title}</span>`)
        }

        if (widget.value != null) {
            out.push(`<span class="value">${widget.value}</span>`)
        }

        out.push(`</div>`)

        if (widget.url != null) {
            out.push(`</a>`)
        }

        return out.join('\n')
    }

    private static renderStringWidget(widget: StringWidget): string {
        let out: string[] = new Array()

        if (widget.title != null) {
            out.push(`<a name="${createAnchor(widget.title)}"></a>`)
        }

        if (widget.url != null) {
            out.push(`<a href="${widget.url}">`)
        }

        out.push(`<div class="string_widget${widget.color ? ' ' + widget.color : ''}">`)

        if (widget.title != null) {
            out.push(`<h3 class="title">${widget.title}</h3>`)
        }

        if (widget.value != null) {
            out.push(`<span class="value">${widget.value}</span>`)
        }

        out.push(`</div> <!-- string_widget -->`)

        if (widget.url != null) {
            out.push(`</a>`)
        }

        return out.join('\n')
    }

    private static renderGraphWidget(widget: GraphWidget): string {
        let html: string[] = new Array()

        let min = 0
        let max = 0

        for (let element of widget.elements) {
            if (! (element instanceof NumberWidget)) {
                throw new Error(`GraphWidget element did not evaluate to a NumberWidget (is a ${widget.constructor.name})`)
            }

            let num = element as NumberWidget

            if (typeof num.value != 'number') {
                throw new Error(`GraphWidget element did not evaluate to a static number (is a ${typeof num.value})`)
            }

            let value = num.value as number

            if (value > max) {
                max = num.value
            }
        }

        html.push(`<div class="graph_widget">`)

        if (widget.title != null) {
            const linkedTitle = widget.url ? `<a href="${widget.url}">${widget.title}</a>` : widget.title
            html.push(`<a name="${createAnchor(widget.title)}"></a>`)
            html.push(`<h3 class="graph_title">${linkedTitle}</h3>`)
        }

        html.push(`<div class="graph">`)

        for (let element of widget.elements) {
            let num = element as NumberWidget
            let value = num.value as number
            let scaled = (max > 0) ? Math.floor((value / max) * 100) : 0

            html.push(`<div class="graph_item${num.color ? ' ' + num.color : ''}">`)
            html.push(`<span class="graph_item_title">`)

            if (num.title != null) {
                if (num.url != null) {
                    html.push(`<a href="${num.url}">`)
                }

                html.push(`<span class="title">${num.title}</span>`)

                if (num.url != null) {
                    html.push(`</a>`)
                }
            }

            html.push(`</span>`)

            html.push(`<span class="graph_item_value">`)

            if (num.url != null) {
                html.push(`<a href="${num.url}">`)
            }

            let value_class = (scaled > 0) ? 'value' : 'value empty_value'
            let value_display = (scaled >= 5) ? value : ''
            html.push(`<span class="${value_class}" style="width: ${scaled}%;">${value_display}</span>`)
            if (num.url != null) {
                html.push(`</a>`)
            }

            html.push(`</span>`)

            html.push(`</div>`)
        }

        html.push(`</div>`)

        html.push(`</div>`)

        return html.join('\n')
    }

    private static renderTableCell(type: string, cell: Widget): string {
        let html: string[] = new Array()

        if (!(cell instanceof NumberWidget) && !(cell instanceof StringWidget)) {
            throw new Error(`TableWidget header cell did not evaluate to a static value (is a ${typeof cell})`)
        }

        let value = (cell as (NumberWidget | StringWidget)).value
        let color = (cell as (NumberWidget | StringWidget)).color
        let url = (cell as (NumberWidget | StringWidget)).url
        let align: string | null = null

        if (cell instanceof StringWidget) {
            align = (cell as StringWidget).align
        }

        align = align != null ? ` style="text-align: ${align}"` : ''
        color = color != null ? ` class="${color}"` : ''
        html.push(`<${type}${color}${align}>`)

        if (url != null) {
            html.push(`<a href="${url}">`)
        }

        html.push(`${value}`)

        if (url != null) {
            html.push(`</a>`)
        }

        html.push(`</${type}>`)

        return html.join('')
    }

    private static renderTableWidget(widget: TableWidget): string {
        let html: string[] = new Array()

        html.push(`<div class="table_widget">`)

        if (widget.title != null) {
            const linkedTitle = widget.url ? `<a href="${widget.url}">${widget.title}</a>` : widget.title
            html.push(`<a name="${createAnchor(widget.title)}"></a>`)
            html.push(`<h3 class="table_title">${linkedTitle}</h3>`)
        }

        html.push(`<table class="table">`)

        if (widget.headers != null && widget.headers.length > 0) {
            html.push(`<tr class="table_header">`)

            for (let cell of widget.headers) {
                html.push(HtmlRenderer.renderTableCell('th', cell))
            }

            html.push(`</tr>`)
        }

        for (let row of widget.elements) {
            html.push(`<tr class="table_element">`)

            for (let cell of row) {
                html.push(HtmlRenderer.renderTableCell('td', cell))
            }
            
            html.push(`</tr>`)
        }

        html.push(`</table>`)
        html.push(`</div>`)

        return html.join('\n')
    }

    private static renderAnalytics(analytics: Analytics): string {
        let html: string[] = new Array()

        html.push(`
<html>
<head>
<title>${analytics.title ? analytics.title : 'Dashboard'}</title>
<link rel="stylesheet" href="dashboard.css" type="text/css" media="all">
<script src="dashboard.js"></script>
</head>
<body>
<div id="analytics">
`)
    
        if (analytics.title != null) {
            html.push(`<h1>${analytics.title}</h1>`)
            html.push('')
        }
    
        if (analytics.description != null) {
            html.push(`<div id="main_description" class="description">`)
            html.push(analytics.description)
            html.push(`</div>`)
            html.push('')
        }
    
        html.push(`<div class="sections">`)

        for (let section of analytics.sections) {
            html.push(`<div class="section">`)

            html.push(`<div class="section_metadata">`)

            if (section.title != null) {
                html.push(`<a name="${createAnchor(section.title)}"></a>`)
                html.push(`<h2 class="section_title">${section.title}</h2>`)
                html.push('')
            }

            if (section.description != null) {
                html.push(`<div class="description">`)
                html.push(section.description)
                html.push(`</div>`)
                html.push('')
            }

            html.push(`</div> <!-- section_metadata -->`)
            html.push(`<div class="section_widgets">`)
    
            let showingNumberWidgets = false
            for (let widget of section.widgets) {
                if (widget instanceof NumberWidget) {
                    // Group the number widgets together
                    if (!showingNumberWidgets) {
                        html.push(HtmlRenderer.renderStartNumberWidgets())
                        showingNumberWidgets = true
                    }

                    html.push(HtmlRenderer.renderNumberWidget(widget as NumberWidget))
                    continue
                }

                if (showingNumberWidgets) {
                    html.push(HtmlRenderer.renderFinishNumberWidgets())
                    showingNumberWidgets = false
                }

                if (widget instanceof StringWidget) {
                    html.push(HtmlRenderer.renderStringWidget(widget as StringWidget))
                } else if (widget instanceof GraphWidget) {
                    html.push(HtmlRenderer.renderGraphWidget(widget as GraphWidget))
                }
                else if (widget instanceof TableWidget) {
                    html.push(HtmlRenderer.renderTableWidget(widget as TableWidget))
                }
                else {
                    throw new Error(`cannot render unknown widget type: ${widget.constructor.name}`)
                }
            }

            if (showingNumberWidgets) {
                html.push(HtmlRenderer.renderFinishNumberWidgets())
                showingNumberWidgets = false
            }

            html.push(`</div> <!-- section_widgets -->`)
            html.push(`</div> <!-- section -->`)
        }

        html.push(`
</div> <!-- sections -->
<div id="footer">
Generated by <a href="https://github.com/ethomson/dashboard" target="_blank" rel="noopener noreferrer">dashboard</a>
</div>
</div> <!-- analytics -->
</body>
</html>
`)
    
        return html.join('\n')
    }

    public render(analytics: Analytics): void {
        fs.writeFileSync(this.config.filename, HtmlRenderer.renderAnalytics(analytics), 'utf8')
    }
}
