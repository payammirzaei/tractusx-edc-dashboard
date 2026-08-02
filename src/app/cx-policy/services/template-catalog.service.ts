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

import { Injectable } from '@angular/core';
import { Action, PolicyConfiguration } from '../models/policy';
import { PolicyTemplates } from './atomic-constraints';

export type TemplateRuleKind = 'Blank' | 'Permission' | 'Obligation' | 'Prohibition';

export interface TemplateCatalogEntry {
  id: string;
  name: string;
  kind: TemplateRuleKind;
  isBlank: boolean;
  create: () => PolicyConfiguration;
}

@Injectable({ providedIn: 'root' })
export class TemplateCatalogService {
  listFor(type: Action): TemplateCatalogEntry[] {
    if (type === Action.Access) {
      const blank: TemplateCatalogEntry = {
        id: 'access-blank',
        name: 'Blank Access Policy',
        kind: 'Blank',
        isBlank: true,
        create: () => PolicyTemplates.AccessTemplate(),
      };
      const catalog = PolicyTemplates.AccessTemplates().map((cfg, index) => ({
        id: `access-${index}-${cfg.name}`,
        name: cfg.name,
        kind: 'Permission' as const,
        isBlank: false,
        create: () => PolicyTemplates.AccessTemplates()[index],
      }));
      return [blank, ...catalog];
    }

    const blank: TemplateCatalogEntry = {
      id: 'usage-blank',
      name: 'Blank Usage Policy',
      kind: 'Blank',
      isBlank: true,
      create: () => PolicyTemplates.UsageTemplate(),
    };
    const catalog = PolicyTemplates.UsageTemplates().map((cfg, index) => ({
      id: `usage-${index}-${cfg.name}`,
      name: cfg.name,
      kind: this.kindForUsageTemplate(cfg),
      isBlank: false,
      create: () => PolicyTemplates.UsageTemplates()[index],
    }));
    return [blank, ...catalog];
  }

  filter(entries: TemplateCatalogEntry[], query: string): TemplateCatalogEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) {
      return entries;
    }
    return entries.filter(e => e.name.toLowerCase().includes(q) || e.kind.toLowerCase().includes(q));
  }

  private kindForUsageTemplate(cfg: PolicyConfiguration): TemplateRuleKind {
    if (cfg.policy.obligations.length > 0) {
      return 'Obligation';
    }
    if (cfg.policy.prohibitions.length > 0) {
      return 'Prohibition';
    }
    return 'Permission';
  }
}
