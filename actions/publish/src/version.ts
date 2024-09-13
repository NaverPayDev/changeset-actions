import path from 'path'

import * as core from '@actions/core'
import {exec} from '@actions/exec'
import * as github from '@actions/github'
import fs from 'fs-extra'
import resolveFrom from 'resolve-from'

import {switchBranch, reset, checkIfClean, push, commitAll} from '$actions/utils'

import {getCurrentVersions, getChangedPackages, getChangelogEntry, sortByHighestLevel} from './utils/file'
import {geneatePrBody} from './utils/pr'

const cwd = process.cwd()

interface VersionOptions {
    githubToken: string
    prTitle?: string
    commitMessage?: string
}

export async function runVersion({githubToken, prTitle, commitMessage}: VersionOptions) {
    const octokit = github.getOctokit(githubToken)

    // changeset-release 브랜치 이동
    const currentRepo = `${github.context.repo.owner}/${github.context.repo.repo}`
    const currentBranch = github.context.ref.replace('refs/heads/', '')
    const versionBranch = `changeset-release/${currentBranch}`

    await switchBranch(versionBranch)
    await reset(github.context.sha)

    // 변경 버전 변경 반영
    const versions = await getCurrentVersions(cwd)

    await exec('node', [resolveFrom('version', '@changesets/cli/bin.js'), 'version'], {
        cwd,
    })

    // 변경패키지를 기준으로 CHANGELOG 컨텐츠 생성
    const changedPackages = await getChangedPackages(cwd, versions)

    const changedPackagesInfoPromises = await Promise.all(
        changedPackages.map(async (pkg) => {
            const changelogContents = await fs.readFile(path.join(pkg.dir, 'CHANGELOG.md'), 'utf8')

            const entry = getChangelogEntry(changelogContents, pkg.packageJson.version)

            return {
                highestLevel: entry.highestLevel,
                private: Boolean(pkg.packageJson.private),
                content: entry.content,
                header: `## ${pkg.packageJson.name}@${pkg.packageJson.version}`,
            }
        }),
    )

    // formatting_script 가 존재하고 변경된 파일중에 .changeset/*.md 가 존재한다면
    const formattingScript = core.getInput('formatting_script')

    if (formattingScript != null) {
        try {
            // formatting 명령어 실행
            await exec('sh', ['-c', formattingScript])
        } catch (e) {
            // nothing..
        }
    }

    // 저장소가 clean 한지 체크하고 commit 메시지를 추가 후 푸시합니다.
    if (!(await checkIfClean())) {
        await commitAll(`${commitMessage}`)
    }
    await push(versionBranch, {force: true})

    // PR content body를 생성합니다.
    const searchResult = await octokit.rest.search.issuesAndPullRequests({
        q: `repo:${currentRepo}+state:open+head:${versionBranch}+base:${currentBranch}+is:pull-request`,
    })

    core.info(JSON.stringify(searchResult.data, null, 2))

    // (major > minor > patch) 순으로 정렬
    const changedPackagesInfo = (await changedPackagesInfoPromises).filter((x) => x).sort(sortByHighestLevel)

    const prBody = await geneatePrBody({
        changedPackagesInfo,
    })

    // 기존 PR 여부에 따라 PR 을 생성 또는 업데이트합니다
    if (searchResult.data.items.length === 0) {
        core.info('creating pull request')
        const {data: newPullRequest} = await octokit.rest.pulls.create({
            base: currentBranch,
            head: versionBranch,
            title: prTitle,
            body: prBody,
            ...github.context.repo,
        })

        return {
            pullRequestNumber: newPullRequest.number,
        }
    } else {
        const [pullRequest] = searchResult.data.items

        core.info(`updating found pull request #${pullRequest.number}`)

        await octokit.rest.pulls.update({
            pull_number: pullRequest.number,
            title: prTitle,
            body: prBody,
            ...github.context.repo,
        })

        return {
            pullRequestNumber: pullRequest.number,
        }
    }
}
