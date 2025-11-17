import * as core from '@actions/core'

export async function setNpmRc() {
    core.info('Using OIDC trusted publishing for npm authentication')
    core.info('Ensure npm CLI 11.5.1+ is installed and id-token: write permission is set')
}
