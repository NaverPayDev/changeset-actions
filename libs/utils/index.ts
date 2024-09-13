import * as github from '@actions/github'

export const getOctokitRestCommonParams = () => {
    const {
        repo: {owner, repo},
        ref,
    } = github.context

    return {owner, repo, ref}
}

export * from './git'
export * from './files'
export * from './uniqBy'
