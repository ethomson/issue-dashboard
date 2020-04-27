import * as core from '@actions/core'
import { GitHub } from '@actions/github'
import { AnalyticsConfig } from './config'
import { Analytics } from './analytics'
import { Renderer } from './render'

async function run(): Promise<void> {
    try {
        const token = core.getInput('token') || process.env.GITHUB_TOKEN || ''
        const github = new GitHub(token)

        const config = AnalyticsConfig.from(core.getInput('config', { required: true }))
        const renderer = Renderer.fromConfig(config)

        const result = await Analytics.evaluate(config, github)

        renderer.render(result)
    } catch (err) {
        core.setFailed(err.message)
    }
}

run()
