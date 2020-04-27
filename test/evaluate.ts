import { Evaluate } from '../src/evaluate'

import { expect } from 'chai'
import 'mocha'

describe('JavaScript evaluation', () => {
    it('can evaluate JavaScript', async () => {
        expect(await Evaluate.parseExpression(`{{ 'a' }} {{ 'b' }} {{ 'c' }} {{ 'd' }} {{ 'e' }} {{ 'f' }} {{ 'g' }}`)).to.eql("a b c d e f g")
        expect(await Evaluate.parseExpression('{{ 4+4 }}')).to.eql('8')
        expect(await Evaluate.parseExpression('{{ 21 * 2 }}')).to.eql('42')
        expect(await Evaluate.parseExpression('foo{{ "bar".repeat(3) }}')).to.eql("foobarbarbar")
        expect(await Evaluate.parseExpression('foo{{ "bar".repeat(3) }}foo')).to.eql("foobarbarbarfoo")
        expect(await Evaluate.parseExpression('{{ await "foo" }}')).to.eql('foo')
        expect(await Evaluate.parseExpression('{{ (() => { return "hello" } )() }} world')).to.eql('hello world')
        expect(await Evaluate.parseExpression('{{ (async () => { let i = 0; for (i = 0; i < 500000; i++); return i })() }}')).to.eql('500000')
    })

    it('can add data to the context', async () => {
        let additional: { [key: string]: string } = { }

        additional.user_in = 'input'

        expect(await Evaluate.parseExpression(`{{ (() => { return user_in })() }}`, additional)).to.eql('input')
    })

    it('can escape curly braces', async () => {
        expect(await Evaluate.parseExpression(`{{ '\\}' }}`)).to.eql('}')
        expect(await Evaluate.parseExpression(`{{ '\\}\\}' }}`)).to.eql('}}')
    })
})

describe('Date adjustment parsing', () => {
    it('can get current date', async () => {
        // meh
        let start = new Date().toISOString().replace(/T.*/, '')
        let parsed = await Evaluate.parseExpression('{{date()}}')
        let finish = new Date().toISOString().replace(/T.*/, '')

        expect(start.localeCompare(parsed)).to.be.at.most(0)
        expect(finish.localeCompare(parsed)).to.be.at.least(0)
    })
    it('can subtract days from current date', async () => {
        let parsed = await Evaluate.parseExpression(`{{date(' - 7 days') }}`)
        let now = new Date().toISOString().replace(/T.*/, '')
        expect(now.localeCompare(parsed)).to.be.above(0)
    })
    it('can get current datetime', async () => {
        // meh
        let start = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
        let parsed = await Evaluate.parseExpression('{{datetime()}}')
        let finish = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

        expect(start.localeCompare(parsed)).to.be.at.most(0)
        expect(finish.localeCompare(parsed)).to.be.at.least(0)
    })
    it('can subtract days from current time', async () => {
        let parsed = await Evaluate.parseExpression(`{{datetime(' - 7 days') }}`)
        let now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
        expect(now.localeCompare(parsed)).to.be.above(0)
    })
    it('can subtract time from current time', async () => {
        let parsed = await Evaluate.parseExpression(`{{datetime(' - 00:00:01 ')}}`)
        let now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
        expect(now.localeCompare(parsed)).to.be.above(0)
    })
    it('can subtract days from an explicit date', async () => {
        expect(await Evaluate.parseExpression(`{{  date('2020-03-01 - 1 day') }}`)).to.eql('2020-02-29')
    })
    it('can subtract days from an explicit datetime', async () => {
        expect(await Evaluate.parseExpression(`{{datetime(' 2020-03-01T14:22:11Z - 1 day') }}`)).to.eql('2020-02-29T14:22:11Z')
    })
    it('can subtract time from an explicit datetime', async () => {
        expect(await Evaluate.parseExpression(`{{ datetime('2020-03-01T14:22:11Z - 02:11:01') }}`)).to.eql('2020-03-01T12:11:10Z')
    })
    it('can subtract time from an explicit time', async () => {
        expect(await Evaluate.parseExpression(`{{time('14:22:11 - 2 hours - 11 minutes - 1 second')}}`)).to.eql('12:11:10')
        expect(await Evaluate.parseExpression(`{{time('14:22:11 - 02:11:01')}}`)).to.eql('12:11:10')
    })
    it('can handle equations with questionable formatting', async () => {
        expect(await Evaluate.parseExpression(`{{date('2020-04-08-1day+7 days')}}`)).to.eql('2020-04-14')
    })
})
