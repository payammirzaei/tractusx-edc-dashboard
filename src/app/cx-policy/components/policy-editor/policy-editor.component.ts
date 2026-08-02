/*
 * Copyright (c) 2023 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
 * Copyright (c) 2025 Fraunhofer-Gesellschaft zur F├╢rderung der angewandten Forschung e.V.
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Apache License, Version 2.0 which is available at
 * https://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { PolicyBuilderComponent } from './policy-builder/policy-builder.component';
import {
  Action,
  AtomicConstraint,
  camelCaseToWords,
  Constraint,
  OutputKind,
  Permission,
  Policy,
  PolicyConfiguration,
  RightOperand,
} from '../../models/policy';
import { FormsModule } from '@angular/forms';
import { AsyncPipe, NgFor } from '@angular/common';
import { FormatService } from '../../services/format.service';
import { PolicyService } from '../../services/policy.service';
import { PolicyTemplates } from '../../services/atomic-constraints';
import { TemplateCatalogEntry, TemplateCatalogService } from '../../services/template-catalog.service';
import { DashboardStateService, EdcClientService } from '@eclipse-edc/dashboard-core';
import { filter, finalize, firstValueFrom, Subject, take, takeUntil } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { JsonObject } from '@angular-devkit/core';

type PendingChange = { kind: 'type'; type: Action } | { kind: 'template'; entry: TemplateCatalogEntry };

@Component({
  selector: 'app-policy-editor',
  templateUrl: './policy-editor.component.html',
  standalone: true,
  imports: [PolicyBuilderComponent, FormsModule, NgFor, AsyncPipe],
})
export class PolicyEditorComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  readonly formatService = inject(FormatService);
  readonly policyService = inject(PolicyService);
  readonly edcClientService = inject(EdcClientService);
  private readonly stateService = inject(DashboardStateService);
  private readonly templateCatalog = inject(TemplateCatalogService);
  private readonly http = inject(HttpClient);

  text!: string;

  outputFormats: string[];
  policyType: Action = Action.Use;
  selectedPolicyType: Action = Action.Use;
  template: PolicyConfiguration;
  templateWarning = false;
  pendingChange?: PendingChange;

  currentFormat: OutputKind;

  showLegalText = true;
  legalTextKinds: string[] = [];

  isValid = true;
  validationLoading = false;
  validationEndpointUrl = '';
  validationErrorText?: string;

  templateDrawerOpen = false;
  templateSearch = '';
  templateEntries: TemplateCatalogEntry[] = [];

  constructor() {
    this.currentFormat = OutputKind.Plain;
    this.template = PolicyTemplates.UsageTemplate();
    this.updateLegalTextKinds(Action.Use);
    this.refreshTemplateCatalog();
    this.outputFormats = this.policyService.supportedOutput();

    this.stateService.currentEdcConfig$
      .pipe(
        takeUntil(this.destroy$),
        filter(x => x !== undefined),
      )
      .subscribe(config => {
        this.validationEndpointUrl = config.managementUrl.concat('/v3/validation/policydefinition');
      });

    this.edcClientService.isHealthy$
      .pipe(
        filter(x => x),
        take(1),
      )
      .subscribe(async () => await this._validatePolicy());
  }

  async ngOnInit() {
    await this.updateJsonText(this.template, this.currentFormat);
  }

  get filteredTemplates(): TemplateCatalogEntry[] {
    return this.templateCatalog.filter(this.templateEntries, this.templateSearch);
  }

  get permissionCount(): number {
    return this.template.policy.permissions.length;
  }

  get obligationCount(): number {
    return this.template.policy.obligations.length;
  }

  get prohibitionCount(): number {
    return this.template.policy.prohibitions.length;
  }

  get constraintCount(): number {
    const rules = [
      ...this.template.policy.permissions,
      ...this.template.policy.obligations,
      ...this.template.policy.prohibitions,
    ];
    return rules.reduce((sum, rule) => sum + rule.constraints.length, 0);
  }

  updateLegalTextKinds(type: Action) {
    if (type === 'use') {
      this.legalTextKinds = ['permissions', 'obligations', 'prohibitions'];
    } else {
      this.legalTextKinds = ['permissions'];
    }
  }

  private isSamePolicy(a: PolicyConfiguration, b: PolicyConfiguration): boolean {
    return (
      this.formatService.formatPolicy(this.formatService.toJsonLd(a, this.currentFormat)) ===
      this.formatService.formatPolicy(this.formatService.toJsonLd(b, this.currentFormat))
    );
  }

  private blankFor(type: Action): PolicyConfiguration {
    return type === Action.Use ? PolicyTemplates.UsageTemplate() : PolicyTemplates.AccessTemplate();
  }

  private refreshTemplateCatalog(): void {
    this.templateEntries = this.templateCatalog.listFor(this.policyType);
  }

  private async switchPolicyType(type: Action): Promise<void> {
    this.policyType = type;
    this.selectedPolicyType = type;
    this.template = this.blankFor(type);
    this.updateLegalTextKinds(type);
    this.refreshTemplateCatalog();
    await this.updateJsonText(this.template, this.currentFormat);
  }

  private async applyTemplate(entry: TemplateCatalogEntry): Promise<void> {
    this.template = entry.create();
    this.policyType = this.template.policy.type;
    this.selectedPolicyType = this.policyType;
    this.updateLegalTextKinds(this.policyType);
    this.refreshTemplateCatalog();
    this.closeTemplateDrawer();
    await this.updateJsonText(this.template, this.currentFormat);
  }

  cancelPendingChange(): void {
    this.selectedPolicyType = this.policyType;
    this.templateWarning = false;
    this.pendingChange = undefined;
  }

  async acceptPendingChange(): Promise<void> {
    if (!this.pendingChange) {
      return;
    }
    if (this.pendingChange.kind === 'type') {
      await this.switchPolicyType(this.pendingChange.type);
    } else {
      await this.applyTemplate(this.pendingChange.entry);
    }
    this.templateWarning = false;
    this.pendingChange = undefined;
  }

  async onTypeChange() {
    if (this.selectedPolicyType === this.policyType) {
      return;
    }
    if (this.isSamePolicy(this.template, this.blankFor(this.policyType))) {
      await this.switchPolicyType(this.selectedPolicyType);
    } else {
      this.pendingChange = { kind: 'type', type: this.selectedPolicyType };
      this.templateWarning = true;
    }
  }

  openTemplateDrawer(): void {
    this.templateSearch = '';
    this.refreshTemplateCatalog();
    this.templateDrawerOpen = true;
  }

  closeTemplateDrawer(): void {
    this.templateDrawerOpen = false;
  }

  async selectTemplate(entry: TemplateCatalogEntry): Promise<void> {
    if (this.isSamePolicy(this.template, this.blankFor(this.policyType))) {
      await this.applyTemplate(entry);
      return;
    }
    this.pendingChange = { kind: 'template', entry };
    this.templateWarning = true;
  }

  async onConfigSelectionChange(cfg: PolicyConfiguration) {
    await this.updateJsonText(cfg, this.currentFormat);
  }

  async onConfigChange(cfg: PolicyConfiguration): Promise<void> {
    await this.updateJsonText(cfg, this.currentFormat);
  }

  private async _validatePolicy(): Promise<void> {
    if ((await firstValueFrom(this.edcClientService.isHealthy$)) && this.validationEndpointUrl) {
      this.validationLoading = true;
      this.http
        .post<JsonObject>(this.validationEndpointUrl, JSON.parse(this.text))
        .pipe(finalize(() => (this.validationLoading = false)))
        .subscribe({
          next: result => {
            this.isValid = result['isValid'] as boolean;
            if (result['errors']) {
              this.validationErrorText = JSON.stringify(result['errors']);
            } else {
              this.validationErrorText = undefined;
            }
          },
          error: err => {
            this.isValid = false;
            this.validationErrorText = err.error[0].message;
          },
        });
    }
  }

  async updateJsonText(cfg: PolicyConfiguration, format: OutputKind) {
    const ld = this.formatService.toJsonLd(cfg, format);
    this.text = this.formatService.formatPolicy(ld);
    await this._validatePolicy();
  }

  async copyPolicyToClipboard(): Promise<void> {
    await navigator.clipboard.writeText(this.text);
  }

  getPolicyPermission(kind: string): Permission[] {
    return this.template.policy[kind as keyof Policy] as Permission[];
  }

  getAtomicConstraints(list: Constraint[]) {
    return list as AtomicConstraint[];
  }

  getRightOperandArray(operand: RightOperand | RightOperand[]): RightOperand[] {
    const arr = Array.isArray(operand) ? operand : [operand];
    const seen = new Set<string>();
    return arr.filter(op => {
      if (seen.has(op.name)) {
        return false;
      }
      seen.add(op.name);
      return true;
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected readonly Action = Action;
  protected readonly camelCaseToWords = camelCaseToWords;
}
