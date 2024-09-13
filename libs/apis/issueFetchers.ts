import * as core from '@actions/core'
import * as github from '@actions/github'

import {CommonIssueParams, OctokitRestCommonParamsType, UpdateIssueParams} from '$actions/types'

const createIssueFetchers = (octokitRestCommonParams: OctokitRestCommonParamsType) => {
    const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN')
    const octokit = github.getOctokit(GITHUB_TOKEN)
    const issueApi = octokit.rest.issues
    const {
        issue: {number: issue_number},
    } = github.context

    /**
     * 이슈를 생성합니다.
     * see) https://docs.github.com/ko/rest/issues/issues?apiVersion=2022-11-28#create-an-issue
     */
    const createIssue = async (params: CommonIssueParams) => {
        issueApi.create({...octokitRestCommonParams, ...params})
    }

    /**
     * 이슈를 업데이트 합니다.
     * see) https://docs.github.com/ko/rest/issues/issues?apiVersion=2022-11-28#update-an-issue
     */
    const updateIssue = async ({issueNumber, ...restParams}: UpdateIssueParams) => {
        issueApi.update({...octokitRestCommonParams, issue_number: issueNumber, ...restParams})
    }

    /**
     * 이슈에 comment를 추가합니다.
     * see) https://docs.github.com/ko/rest/issues/comments?apiVersion=2022-11-28#create-an-issue-comment
     */
    const addComment = async (body: string) => {
        issueApi.createComment({...octokitRestCommonParams, issue_number, body})
    }

    return {
        createIssue,
        updateIssue,
        addComment,
    }
}

export default createIssueFetchers
