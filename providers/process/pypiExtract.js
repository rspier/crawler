// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')
const { get } = require('lodash')

class PyPiExtract extends BaseHandler {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  get schemaVersion() {
    return '1.1.1'
  }

  get toolSpec() {
    return { tool: 'clearlydefined', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'pypi' && spec && spec.type === 'pypi'
  }

  async handle(request) {
    if (this.isProcessing(request)) {
      const { spec } = super._process(request)
      this.addBasicToolLinks(request, spec)
      await this._createDocument(request, spec, request.document.registryData)
      await BaseHandler.addInterestingFiles(request.document, request.document.location)
    }
    this.linkAndQueueTool(request, 'scancode')
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }

  async _discoverSource(revision, registryData) {
    if (!registryData) return null
    const candidates = []
    candidates.push(get(registryData, 'info.bugtrack_url'))
    candidates.push(get(registryData, 'info.docs_url'))
    candidates.push(get(registryData, 'info.download_url'))
    candidates.push(get(registryData, 'info.home_page'))
    candidates.push(get(registryData, 'info.package_url'))
    candidates.push(get(registryData, 'info.project_url'))
    candidates.push(get(registryData, 'info.release_url'))
    const allCandidates = candidates.filter(e => e)
    return this.sourceFinder(revision, allCandidates, { githubToken: this.options.githubToken })
  }

  async _createDocument(request, spec, registryData) {
    const sourceInfo = await this._discoverSource(spec.revision, registryData)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }
}

module.exports = (options, sourceFinder) => new PyPiExtract(options, sourceFinder || sourceDiscovery)
