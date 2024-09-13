import * as core from '@actions/core'
import readChangesets from '@changesets/read'

import createFetchers from '$actions/apis'
import {setGithubUserInfo} from '$actions/utils'

import {runPublish} from './publish'
import {setNpmRc} from './utils/npm'
import {runVersion} from './version'

const cwd = process.cwd()

async function actions() {
    const changesets = await readChangesets(cwd)

    const githubToken = core.getInput('github_token')
    const publishScript = core.getInput('publish_script')

    const {
        repoFetchers: {getRepoInfo},
    } = createFetchers()
    const {git_url} = await getRepoInfo()

    // 깃헙 유저 정보 설정
    await setGithubUserInfo({
        repoUrl: git_url.replace('git://', ''),
        githubToken,
        username: core.getInput('git_username'),
        email: core.getInput('git_email'),
    })

    if (changesets.length === 0) {
        // npmrc 생성
        await setNpmRc()

        // 변경된 사항들이 이미 반영되어있는 상태라면 publishScript 에 따른 동작을 수행합니다.
        const createGithubReleaseTag = Boolean(core.getInput('create_github_release_tag'))

        const result = await runPublish({
            publishScript,
            createGithubReleaseTag,
        })

        if (result.published) {
            core.setOutput('published', 'true')
            core.setOutput('publishedPackages', JSON.stringify(result.publishedPackages))
            core.setOutput('message', result.message)
        }
    } else {
        // 변경된 사항에 따른 버전을 반영하고, CHANGELOG 및 PR 을 생성합니다.
        const {pullRequestNumber} = await runVersion({
            githubToken,
            prTitle: core.getInput('pr_title'),
            commitMessage: core.getInput('commit_message'),
        })

        core.setOutput('pullRequestNumber', String(pullRequestNumber))
    }
}

actions()
