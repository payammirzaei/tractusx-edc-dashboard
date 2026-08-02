/*
 *  Copyright (c) 2025 Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung e.V.
 *
 *  See the NOTICE file(s) distributed with this work for additional
 *  information regarding copyright ownership.
 *
 *  This program and the accompanying materials are made available under the
 *  terms of the Apache License, Version 2.0 which is available at
 *  https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 *  WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 *  License for the specific language governing permissions and limitations
 *  under the License.
 *
 *  SPDX-License-Identifier: Apache-2.0
 */

import { AtomicConstraint, Operator } from '../models/policy';
import { filterConstraintsByQuery } from './constraint-catalog.util';

function stubConstraint(leftOperand: string): AtomicConstraint {
  return new AtomicConstraint(leftOperand, [Operator.Eq], {
    name: leftOperand,
    operandType: 'string',
    value: 'x',
  });
}

describe('filterConstraintsByQuery', () => {
  const catalog = [
    stubConstraint('BusinessPartnerNumber'),
    stubConstraint('Membership'),
    stubConstraint('UsagePurpose'),
  ];

  it('returns all constraints when query is empty', () => {
    expect(filterConstraintsByQuery(catalog, '')).toEqual(catalog);
    expect(filterConstraintsByQuery(catalog, '   ')).toEqual(catalog);
  });

  it('matches human-readable labels case-insensitively', () => {
    const result = filterConstraintsByQuery(catalog, 'business partner');
    expect(result.map(c => c.leftOperand)).toEqual(['BusinessPartnerNumber']);
  });

  it('matches raw leftOperand tokens', () => {
    const result = filterConstraintsByQuery(catalog, 'usagepurpose');
    expect(result.map(c => c.leftOperand)).toEqual(['UsagePurpose']);
  });

  it('returns empty list when nothing matches', () => {
    expect(filterConstraintsByQuery(catalog, 'warranty')).toEqual([]);
  });
});
