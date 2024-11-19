import * as path from 'path'

import * as github from '@actions/github'
import {Package} from '@manypkg/get-packages'
import * as fs from 'fs-extra'

import createFetchers from '$actions/apis'

import {getChangelogEntry} from './file'

export const createReleaseTag = async ({pkg, tagName}: {pkg: Package; tagName: string}) => {
    try {
        const changelog = await fs.readFile(path.join(pkg.dir, 'CHANGELOG.md'), 'utf8')
        const changelogEntry = getChangelogEntry(changelog, pkg.packageJson.version)

        if (!changelogEntry) {
            throw new Error(`${pkg.packageJson.name}@${pkg.packageJson.version}의 변경항목을 찾을 수 없습니다.`)
        }

        const {repoFetchers} = createFetchers()

        await repoFetchers.createRelease({
            name: tagName,
            tagName,
            body: changelogEntry.content,
            prerelease: pkg.packageJson.version.includes('-'),
            ...github.context.repo,
        })
    } catch (err) {
        if (err && typeof err === 'object' && 'code' in err && err.code !== 'ENOENT') {
            throw err
        }
    }
}
