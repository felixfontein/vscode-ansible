#!/usr/bin/env groovy
/* groovylint-disable GStringExpressionWithinString MethodReturnTypeRequired FactoryMethodName UnnecessaryGetter */
/* cspell:ignore nocolor, audjirka, shamishr */

def installBuildRequirements() {
  def nodeHome = tool 'nodejs-lts'
  env.PATH = "${env.PATH}:${nodeHome}/bin"

  sh 'npm install --global yarn'
}

node('rhel8') {
  stage('checkout') {
        deleteDir()
        git url: "https://github.com/${params.FORK}/vscode-ansible.git", branch: params.BRANCH
  }

  stage('requirements') {
    installBuildRequirements()
  }

  stage('build') {
    sh 'yarn install'
    sh 'yarn run compile'
    sh 'yarn run webpack'
  }

  stage('package') {
    def packageJson = readJSON file: 'package.json'
    // We always replace MAJOR.MINOR.PATCH from package.json with MAJOR.MINOR.BUILD
    def version = packageJson.version[0..packageJson.version.lastIndexOf('.') - 1] + ".${env.BUILD_NUMBER}"
    sh "yarn run vsce package ${ params.publishPreRelease ? '--pre-release' : '' } --no-dependencies --no-git-tag-version --no-update-package-json ${ version }"
  }

  if (params.UPLOAD_LOCATION) {
    stage('snapshot') {
        def filesToPush = findFiles(glob: '**.vsix')
        sh "sftp -C ${UPLOAD_LOCATION}/snapshots/vscode-ansible/ <<< \$'put -p -r ${filesToPush[0].path}'"
        stash name:'vsix', includes:filesToPush[0].path
    }
  }
}

node('rhel8') {
  print "DEBUG: parameter publishPreRelease=${params.publishPreRelease}"
  timeout(time:5, unit:'DAYS') {
    // these are LDAP accounts
    input message:'Approve deployment?', submitter: 'ssbarnea,ssydoren,gnalawad,prsahoo,bthornto,audjirka,shamishr'
  }

  stage('publish') {
    unstash 'vsix'
    def vsix = findFiles(glob: '**.vsix')
    // VS Code Marketplace
    withCredentials([[$class: 'StringBinding', credentialsId: 'vscode_java_marketplace', variable: 'TOKEN']]) {
      sh "yarn run vsce publish -p $TOKEN ${params.publishPreRelease ? '--pre-release' : ''} --packagePath ${vsix[0].path}"
    }
    archive includes:'**.vsix'

    // Open-vsx Marketplace
    withCredentials([[$class: 'StringBinding', credentialsId: 'open-vsx-access-token', variable: 'OVSX_TOKEN']]) {
      sh "yarn run ovsx publish -p $OVSX_TOKEN ${vsix[0].path}"
    }
    sh "sftp -C ${UPLOAD_LOCATION}/stable/vscode-ansible/ <<< \$'put -p -r ${vsix[0].path}'"
  }
}
