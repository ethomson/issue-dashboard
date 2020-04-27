// A mechanism for evaluating user-provided strings or scripts.  For
// strings, this will take user input and parse anything within
// double curly-braces (`{{ }}`) as eval-able JavaScript.  Several
// helper functions (like `date()`, `time()`, etc) will be provided.
// Users can provide additional data that will be given to the
// functions.

import { date, time, datetime } from './date'

export class Evaluate {
    private static invokeAsyncFunction(source: string, args: { [key: string]: any }): Promise<any> {
        const asyncFn = Object.getPrototypeOf(async () => {}).constructor
        const fn = new asyncFn(...Object.keys(args), source)

        return fn(...Object.values(args))
    }

    private static createArgs(additional: { [key: string]: any } | null = null) {
        let args: { [key: string]: any } = {
            date: date,
            time: time,
            datetime: datetime
        }

        for (let key in additional) {
            if (key in args) {
                throw new Error(`cannot redefine evaluation global '${key}'`)
            }

            args[key] = additional[key]
        }

        return args
    }

    public static async runScript(input: string, additional: { [key: string]: any } | null = null): Promise<any> {
        const args = Evaluate.createArgs(additional)
        return await Evaluate.invokeAsyncFunction(input, args)
    }

    public static async parseExpression(raw: string, additional: { [key: string]: any } | null = null): Promise<string> {
        const args = Evaluate.createArgs(additional)

        const search = new RegExp('{{(.*?)}}', 'g')
        let match: RegExpExecArray | null
        let output: string[] = new Array()
        let last = 0

        while (match = search.exec(raw)) {
            if (match.index > 0) {
                output.push(raw.substring(last, match.index))
            }

            output.push(await Evaluate.invokeAsyncFunction(
                `return (async () => ${match[1]})()`, args))

            last = search.lastIndex
        }

        if (last < raw.length) {
            output.push(raw.substring(last, raw.length))
        }

        return output.join('')
    }
}
