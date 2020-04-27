import { queryToUrl } from '../src/analytics'

import { expect } from 'chai'
import 'mocha'

describe('URL translation', () => {
    it('can translate query without repo to url', () => {
        expect(queryToUrl('is:pr created:>=2020-02-29 is:open')).to.eql('https://github.com/search?q=is%3Apr%20created%3A%3E%3D2020-02-29%20is%3Aopen')
    })

    it('can translate query with repo to url', () => {
        expect(queryToUrl('repo:foo/bar is:pr created:>=2020-02-29 is:open')).to.eql('https://github.com/foo/bar/issues?q=is%3Apr%20created%3A%3E%3D2020-02-29%20is%3Aopen')
        expect(queryToUrl('is:pr repo:foo/bar created:>=2020-02-29 is:open')).to.eql('https://github.com/foo/bar/issues?q=is%3Apr%20created%3A%3E%3D2020-02-29%20is%3Aopen')
        expect(queryToUrl('is:pr created:>=2020-02-29 is:open repo:foo/bar')).to.eql('https://github.com/foo/bar/issues?q=is%3Apr%20created%3A%3E%3D2020-02-29%20is%3Aopen')
    })

    it('can strip extraneous whitepace from query url', () => {
        expect(queryToUrl(' is:pr  repo:foo/bar   created:>=2020-02-29     is:open\t')).to.eql('https://github.com/foo/bar/issues?q=is%3Apr%20created%3A%3E%3D2020-02-29%20is%3Aopen')
    })
})
