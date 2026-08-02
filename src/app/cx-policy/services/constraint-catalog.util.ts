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

import { AtomicConstraint, camelCaseToWords } from '../models/policy';

/** Filters catalog constraints by leftOperand or human-readable label. */
export function filterConstraintsByQuery(constraints: AtomicConstraint[], query: string): AtomicConstraint[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return constraints;
  }
  return constraints.filter(c => {
    const label = camelCaseToWords(c.leftOperand).toLowerCase();
    return label.includes(q) || c.leftOperand.toLowerCase().includes(q);
  });
}
