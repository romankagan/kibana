/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * and the Server Side Public License, v 1; you may not use this file except in
 * compliance with, at your election, the Elastic License or the Server Side
 * Public License, v 1.
 */

import { writeFileSync } from 'fs';
import shell from 'shelljs';
import * as Either from '../../src/dev/code_coverage/ingest_coverage/either';
import { join } from 'path';
import { REPO_ROOT } from '@kbn/utils';

export const mkDir = (x) => shell.mkdir('-p', x);

const encoding = 'utf8';

const writeUtf8 = { flag: 'w', encoding };

const appendUtf8 = { flag: 'a', encoding };

const writeOrAppend = (x) => (x === 0 ? Either.left(x) : Either.right(x));

export const flushSavedObjects = (dest) => (log) => (payload) => {
  const writeToFile = writeFileSync.bind(null, dest);

  [...payload].forEach((savedObj, i) => {
    const writeCleaned = writeToFile.bind(null, `${JSON.stringify(savedObj, null, 2)}\n\n`);

    writeOrAppend(i).fold(
      () => writeCleaned(writeUtf8),
      () => writeCleaned(appendUtf8)
    );
  });

  log.debug(`\n### Exported saved objects to destination: \n\t${dest}`);
};

const ndjsonToObj = (x) => x.split('\n').map((stanza) => JSON.parse(stanza));

const defaultTypes = ['index-pattern', 'search', 'visualization', 'dashboard'];

export const exportSavedObjects = (types = defaultTypes, excludeExportDetails = true) => async (
  log,
  supertest
) =>
  await supertest
    .post('/api/saved_objects/_export')
    .set('kbn-xsrf', 'anything')
    .send({
      type: types,
      excludeExportDetails,
    })
    .expect(200)
    .expect('Content-Type', /json/)
    .then((resp) => ndjsonToObj(resp.text));

const finalLocations = (dest) => (filePath) => {
  const destDir = join(REPO_ROOT, dest);
  const destFilePath = join(destDir, filePath);
  return [destDir, destFilePath];
};

export const main = (dest) => (log) => async (supertest) => {
  const [destDir, destFilePath] = finalLocations(dest)('./exported.json');

  mkDir(destDir);
  await flushSavedObjects(destFilePath)(log)(await exportSavedObjects()(log, supertest));
};
