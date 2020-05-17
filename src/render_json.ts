// A JSON renderer takes an `Analytics` structure and emits the
// data as a Slack webhook payload JSON.

import { Analytics, NumberWidget } from './analytics'
import { AnalyticsConfig } from './config'
import * as fs from 'fs'

interface JSONConfig {
    format: string
    filename: string
}

export class JSONRenderer {
    private readonly config: JSONConfig

    constructor(config: AnalyticsConfig) {
        if (config == null || config.output == null) {
            throw new Error('invalid configuration for JSON renderer')
        }

        const jsonConfig = config.output as JSONConfig

        if (jsonConfig.format == null || jsonConfig.format !== 'json') {
            throw new Error(`config: 'output.format' expected as 'json'`)
        }

        if (jsonConfig.filename == null) {
            throw new Error(`config: 'output.filename' is not defined`)
        }

        this.config = jsonConfig
    }

    private static renderColor(color: string): string {
        if (color === 'red') {
            return '🔴'
        } else if (color === 'yellow') {
            return '💛'
        } else if (color === 'green') {
            return '✅'
        } else if (color === 'blue') {
            return '🔷'
        } else if (color === 'black') {
            return '⬛️'
        }

        throw new Error(`invalid color: ${color}`)
    }

    private static renderNumberWidget(widget: NumberWidget): string {
        const value = widget.value
        const color = widget.color
        let out = value.toString()

        if (color != null) {
            out = `${JSONRenderer.renderColor(color)} ${out}`
        }

        if (widget.url != null) {
            out = `<${widget.url} | ${out}>`
        }

        return out
    }

    private static renderAnalytics(analytics: Analytics): string {
        const md: string[] = []

        for (const section of analytics.sections) {
            const wd: string[] = []

            for (const widget of section.widgets) {
                if (widget instanceof NumberWidget) {
                    wd.push(
                        `${
                            widget.title ? widget.title : ''
                        }: ${JSONRenderer.renderNumberWidget(widget)}`
                    )
                }
            }

            const widgetStats = wd.join('\\n')

            md.push(`
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*${section.title}*"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "${widgetStats}"
                    }
                }`)
        }

        const blocks = md.join(`
            ,
            {
                "type": "divider"
            },
        `)

        return `
        {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*${analytics.title}*"
                    }
                },
                ${blocks}
            ]
        }
        `
    }

    render(analytics: Analytics): void {
        fs.writeFileSync(
            this.config.filename,
            JSONRenderer.renderAnalytics(analytics),
            'utf8'
        )
    }
}
