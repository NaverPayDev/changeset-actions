import * as core from '@actions/core'
import * as fs from 'fs-extra'

export async function setNpmRc() {
    core.info('No changesets found, attempting to publish any unpublished packages to npm')

    const npmToken = core.getInput('npm_token')

    const userNpmrcPath = `${process.env.HOME}/.npmrc`
    if (fs.existsSync(userNpmrcPath)) {
        core.info('Found existing user .npmrc file')
        const userNpmrcContent = await fs.readFile(userNpmrcPath, 'utf8')
        const authLine = userNpmrcContent.split('\n').find((line) => {
            // check based on https://github.com/npm/cli/blob/8f8f71e4dd5ee66b3b17888faad5a7bf6c657eed/test/lib/adduser.js#L103-L105
            return /^\s*\/\/registry\.npmjs\.org\/:[_-]authToken=/i.test(line)
        })
        if (authLine) {
            core.info('Found existing auth token for the npm registry in the user .npmrc file')
        } else {
            core.info("Didn't find existing auth token for the npm registry in the user .npmrc file, creating one")
            fs.appendFileSync(userNpmrcPath, `\n//registry.npmjs.org/:_authToken=${npmToken}\n`)
        }
    } else {
        core.info('No user .npmrc file found, creating one')
        fs.writeFileSync(userNpmrcPath, `//registry.npmjs.org/:_authToken=${npmToken}\n`)
    }
}
