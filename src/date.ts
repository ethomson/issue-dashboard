import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import customParseFormat from 'dayjs/plugin/customParseFormat'

function parse(input: string = ''): dayjs.Dayjs {
    dayjs.extend(utc)
    dayjs.extend(customParseFormat)

    let value: dayjs.Dayjs
    let match: RegExpMatchArray | null
    let currentDate = false

    input = input.toString().replace(/^\s+/, '')

    if (input === "startOfMonth") {
        value = dayjs.utc().startOf('month')
        input = ''
    } else if (match = input.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})Z/)) {
        value = dayjs(match[0])
        input = input.substring(match[0].length)
    }
    else if (match = input.match(/^(\d{4}-\d{2}-\d{2})/)) {
        value = dayjs(`${match[0]} -0000`, 'YYYY-MM-DD Z')
        input = input.substring(match[0].length)
    }
    else if (match = input.match(/^(\d{2}):(\d{2}):(\d{2})/)) {
        value = dayjs()
        value = value.utc().hour(+match[1])
        value = value.utc().minute(+match[2])
        value = value.utc().second(+match[3])
        input = input.substring(match[0].length)
    }
    else {
        value = dayjs()
        currentDate = true
    }

    while (input.length > 0) {
        let operator: string

        input = input.replace(/^\s+/, '')

        if (match = input.match(/^([+-])\s*/)) {
            operator = match[1]
            input = input.substring(match[0].length)
        }
        else if (currentDate != null) {
            // if no date was specified, users don't need a starting operator
            operator = '+'
            currentDate = false
        }
        else {
            throw new Error(`operator expected, got '${input}'`)
        }

        let operation = (operator == '-') ?
            (d: dayjs.Dayjs, v: number, u: dayjs.OpUnitType) => d.utc().subtract(v, u) :
            (d: dayjs.Dayjs, v: number, u: dayjs.OpUnitType) => d.utc().add(v, u)

        if (match = input.match(/^([\d]+)\s*(year|month|day|hour|minute|second)(s?)\s*/)) {
            input = input.substring(match[0].length)
            value = operation(value, +match[1], match[2] as dayjs.OpUnitType)
        }
        else if (match = input.match(/^(\d{2}):(\d{2}):(\d{2})\s*/)) {
            input = input.substring(match[0].length)

            value = operation(value, +match[1], 'hours' as dayjs.OpUnitType)
            value = operation(value, +match[2], 'minutes' as dayjs.OpUnitType)
            value = operation(value, +match[3], 'seconds' as dayjs.OpUnitType)
        }
        else {
            throw new Error(`date adjustment expected, got '${input}'`)
        }
    }

    return value.utc()
}

export function date(input: string | undefined = undefined): string {
    return parse(input).format('YYYY-MM-DD')
}

export function time(input: string | undefined = undefined): string {
    return parse(input).format('HH:mm:ss')
}

export function datetime(input: string | undefined = undefined): string {
    return parse(input).format()
}
