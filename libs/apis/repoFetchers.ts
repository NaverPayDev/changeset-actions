import * as core from '@actions/core'
import * as github from '@actions/github'

import {OctokitRestCommonParamsType} from '$actions/types'

const createRepoFetchers = (octokitRestCommonParams: OctokitRestCommonParamsType) => {
    const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN')
    const octokit = github.getOctokit(GITHUB_TOKEN)

    const repoApi = octokit.rest.repos

    /**
     * 레포 정보를 가져옵니다
     * see) https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#get-a-repository
     */
    const getRepoInfo = async () => {
        const {data: repoInfo} = await repoApi.get({
            ...octokitRestCommonParams,
        })

        return repoInfo
    }

    const createRelease = async ({
        name,
        tagName,
        body,
        prerelease,
    }: {
        name: string
        tagName: string
        body: string
        prerelease: boolean
    }) => {
        await octokit.rest.repos.createRelease({
            name,
            tag_name: tagName,
            body,
            prerelease,
            ...octokitRestCommonParams,
        })
    }

    return {getRepoInfo, createRelease}
}

export default createRepoFetchers
