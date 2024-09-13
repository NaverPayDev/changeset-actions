import {exec, getExecOutput} from '@actions/exec'

export const setGithubUserInfo = async ({
    repoUrl,
    githubToken,
    username,
    email,
}: {
    repoUrl: string
    githubToken: string
    username: string
    email: string
}) => {
    await exec('git', ['config', '--global', 'user.name', username])
    await exec('git', ['config', '--global', 'user.email', email])
    await exec('git', ['remote', 'set-url', 'origin', `https://x-access-token:${githubToken}@${repoUrl}`])
}

export const push = async (branch: string, {force}: {force?: boolean} = {}) => {
    await exec('git', ['push', 'origin', `HEAD:${branch}`, force && '--force'].filter(Boolean) as string[])
}

export const switchBranch = async (branch: string) => {
    try {
        await exec('git', ['switch', branch])
    } catch (error) {
        await exec('git', ['switch', '-c', branch])
    }
}

export const reset = async (pathSpec: string, mode: 'hard' | 'soft' | 'mixed' = 'hard') => {
    await exec('git', ['reset', `--${mode}`, pathSpec])
}

export const commitAll = async (message: string) => {
    await exec('git', ['add', '.'])
    await exec('git', ['commit', '-m', message])
}

export const checkIfClean = async (): Promise<boolean> => {
    const {stdout} = await getExecOutput('git', ['status', '--porcelain'])
    return !stdout.length
}

export const pushTags = async () => {
    await exec('git', ['push', 'origin', '--tags'], {
        silent: true,
        ignoreReturnCode: true,
    })
}
