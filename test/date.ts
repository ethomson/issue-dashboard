import { date, time, datetime } from '../src/date'

import { expect } from 'chai'
import 'mocha'

describe('Date adjustment parsing', () => {
    it('can get current date', () => {
        // since we cannot stop the unending march of time, ensure that
        // the results of `date()` are between the bounds of the
        // start of the test execution and the end of the test execution
        let start = new Date().toISOString().replace(/T.*/, '')
        let d = date()
        let finish = new Date().toISOString().replace(/T.*/, '')

        expect(start.localeCompare(d)).to.be.at.most(0)
        expect(finish.localeCompare(d)).to.be.at.least(0)
    })
    it('can get current time', () => {
        // with time, we risk of flaky test results at midnight
        let start = new Date().toISOString().replace(/.*T/, '').replace(/\.\d{3}Z/, '')
        let t = time()
        let finish = new Date().toISOString().replace(/.*T/, '').replace(/\.\d{3}Z/, '')

        expect(start.localeCompare(t)).to.be.at.most(0)
        expect(finish.localeCompare(t)).to.be.at.least(0)
    })
    it('can get current datetime', () => {
        let start = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
        let dt = datetime()
        let finish = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

        expect(start.localeCompare(dt)).to.be.at.most(0)
        expect(finish.localeCompare(dt)).to.be.at.least(0)
    })
    it('can get a specific date', () => {
        expect(date('2019-01-01')).to.eql('2019-01-01')
        expect(date('2018-10-11T13:44:22Z')).to.eql('2018-10-11')

        expect(datetime('2019-01-01')).to.eql('2019-01-01T00:00:00Z')
        expect(datetime('2018-10-11T13:44:22Z')).to.eql('2018-10-11T13:44:22Z')
    })
    it('can get a relative date', () => {
        expect(date("startOfMonth").split('-')[2]).to.eql('01')
    })
    it('can adjust a specific date', () => {
        expect(date('2019-01-01 - 1 day')).to.eql('2018-12-31')
        expect(date('2019-01-01 - 2 years - 3 months - 2 days ')).to.eql('2016-09-29')
        expect(date('2016-10-15 + 1 year - 2 months + 3 days ')).to.eql('2017-08-18')
    })
    it('can adjust the current date', () => {
        // more midnight flaky test risk
        let today = new Date().toISOString().replace(/T.*/, '')

        let one = date(`${today} + 1 day`)
        let two = date('1 day')
        let three = date('+1 day')

        expect(one).to.eql(two)
        expect(one).to.eql(three)
    })
})
