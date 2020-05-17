// A renderer takes an `Analytics` structure and emits it as data.

import { Analytics } from './analytics'
import { AnalyticsConfig } from './config'
import { HtmlRenderer } from './render_html'
import { MarkdownRenderer } from './render_markdown'
import { JSONRenderer } from './render_json'

export abstract class Renderer { 
    public abstract render(analytics: Analytics): void

    public static fromConfig(config: AnalyticsConfig): Renderer {
        if (config.output == null) {
            throw new Error(`config: 'output' is not defined`)
        }

        if (config.output.format == null) {
            throw new Error(`config: 'output.format' is not defined`)
        }

        if (config.output.format == 'json') {
            return new JSONRenderer(config)
        } else if (config.output.format == 'markdown') {
            return new MarkdownRenderer(config)
        }
        else if (config.output.format == 'html') {
            return new HtmlRenderer(config)
        }
        else {
            throw new Error(`config: unknown output format type '${config.output.format}'`)
        }
    }
}
