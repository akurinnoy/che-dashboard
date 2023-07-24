/*
 * Copyright (c) 2018-2023 Red Hat, Inc.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

import * as PF from '@patternfly/react-core';
import { History } from 'history';
import React from 'react';
import { connect, ConnectedProps } from 'react-redux';
import {
  buildFactoryParams,
  FactoryParams,
} from '../../services/helpers/factoryFlow/buildFactoryParams';
import { findTargetWorkspace } from '../../services/helpers/factoryFlow/findTargetWorkspace';
import { getLoaderMode, LoaderMode } from '../../services/helpers/factoryFlow/getLoaderMode';
import { AlertItem, DevWorkspaceStatus, LoaderTab } from '../../services/helpers/types';
import { AppState } from '../../store';
import { storeWorkspaceProgress } from '../../store/WorkspaceProgress';
import * as WorkspaceStore from '../../store/Workspaces';
import { selectAllWorkspaces } from '../../store/Workspaces/selectors';
import { ProgressAlert } from './Alert';
import CommonStepCheckRunningWorkspacesLimit from './CommonSteps/CheckRunningWorkspacesLimit';
import CreatingStepApplyDevfile from './CreatingSteps/Apply/Devfile';
import CreatingStepApplyResources from './CreatingSteps/Apply/Resources';
import CreatingStepCheckExistingWorkspaces from './CreatingSteps/CheckExistingWorkspaces';
import CreatingStepCreateWorkspace from './CreatingSteps/CreateWorkspace';
import CreatingStepFetchDevfile from './CreatingSteps/Fetch/Devfile';
import CreatingStepFetchResources from './CreatingSteps/Fetch/Resources';
import CreatingStepInitialize from './CreatingSteps/Initialize';
import StartingStepInitialize from './StartingSteps/Initialize';
import StartingStepOpenWorkspace from './StartingSteps/OpenWorkspace';
import StartingStepStartWorkspace from './StartingSteps/StartWorkspace';
import StartingStepWorkspaceConditions, {
  ConditionType,
} from './StartingSteps/WorkspaceConditions';
import StepName from './StepName';

import styles from './index.module.css';

export type Props = MappedProps & {
  history: History;
  searchParams: URLSearchParams;
  showToastAlert: boolean;
  onTabChange: (tab: LoaderTab) => void;
};
export type State = {
  activeStep: StepId;
  alertItems: AlertItem[];
  conditions: ConditionType[];
  doneSteps: StepId[];
  factoryParams: FactoryParams;
  initialLoaderMode: LoaderMode;
};

export enum Step {
  INITIALIZE = 'initialize',
  LIMIT_CHECK = 'limit-check',
  CREATE = 'create',
  FETCH = 'fetch',
  CONFLICT_CHECK = 'conflict-check',
  APPLY = 'apply',
  START = 'start',
  OPEN = 'open',
}
type ConditionStepId = `condition-${string}`;
export type StepId = Step | ConditionStepId;

class Progress extends React.PureComponent<Props, State> {
  static contextType = PF.WizardContext;
  readonly context: React.ContextType<typeof PF.WizardContext>;

  private readonly wizardRef: React.RefObject<any>;

  constructor(props: Props) {
    super(props);
    this.wizardRef = React.createRef();

    const initialLoaderMode = getLoaderMode(props.history.location);

    const factoryParams = buildFactoryParams(this.props.searchParams);

    this.state = {
      activeStep: Step.INITIALIZE,
      alertItems: [],
      conditions: [],
      doneSteps: [],
      factoryParams,
      initialLoaderMode,
    };

    this.props.clearSteps();
  }

  public componentDidMount(): void {
    this.init();
  }

  public componentDidUpdate(): void {
    this.init();
  }

  private init(): void {
    const { allWorkspaces, history } = this.props;
    const loaderMode = getLoaderMode(history.location);

    if (loaderMode.mode === 'workspace') {
      const workspace = findTargetWorkspace(allWorkspaces, loaderMode.workspaceParams);
      if (workspace && workspace.status === DevWorkspaceStatus.STARTING) {
        const conditions = (workspace.ref.status?.conditions || []).filter(
          condition => condition.message,
        ) as ConditionType[];

        const lastScore = this.scoreConditions(this.state.conditions);
        const score = this.scoreConditions(conditions);
        if (score > lastScore) {
          this.setState({
            conditions,
          });
        }
      }
    }
  }

  private scoreConditions(conditions: ConditionType[]): number {
    const typeScore = {
      Started: 1,
      DevWorkspaceResolved: 1,
      StorageReady: 1,
      RoutingReady: 1,
      ServiceAccountReady: 1,
      PullSecretsReady: 1,
      DeploymentReady: 1,
    };

    return conditions.reduce((acc, condition) => {
      if (typeScore[condition.type] !== undefined) {
        return acc + typeScore[condition.type];
      }
      return acc;
    }, 0);
  }

  private handleShowStepAlert(step: StepId, alertItem: AlertItem): void {
    if (step !== this.state.activeStep) {
      return;
    }

    const { alertItems } = this.state;
    if (alertItems.some(item => item.key === alertItem.key)) {
      return;
    }

    this.setState({
      alertItems: [...alertItems, alertItem],
    });
  }

  private handleCloseStepAlert(key: string): void {
    const { alertItems } = this.state;

    this.setState({
      alertItems: alertItems?.filter(alertItem => alertItem.key !== key),
    });
  }

  private handleGoToNextStep(step: StepId): void {
    if (step !== this.state.activeStep) {
      return;
    }

    this.wizardRef.current?.onNext();
  }

  private handleRestartFlow(step: StepId, tab?: LoaderTab): void {
    if (step !== this.state.activeStep) {
      return;
    }

    const { history } = this.props;
    const { doneSteps, initialLoaderMode } = this.state;
    const loaderMode = getLoaderMode(history.location);

    let newActiveStep: StepId;
    let newDoneSteps: StepId[];

    if (initialLoaderMode.mode === loaderMode.mode) {
      newActiveStep = Step.INITIALIZE;
      newDoneSteps = [];
    } else {
      newActiveStep = Step.START;
      newDoneSteps = doneSteps.slice(0, doneSteps.indexOf(Step.START));
    }

    this.setState({
      activeStep: newActiveStep,
      doneSteps: newDoneSteps,
      conditions: [],
    });
    this.wizardRef.current?.goToStepById(newActiveStep);

    if (tab) {
      this.props.onTabChange(tab);
    }
  }

  private getSteps(): PF.WizardStep[] {
    console.debug('>>> getSteps');
    const { initialLoaderMode } = this.state;
    const showCreationSteps = initialLoaderMode.mode === 'factory';

    return [
      showCreationSteps ? this.getCreationInitStep() : this.getStartingInitStep(),
      ...this.getCommonSteps(),
      ...(showCreationSteps ? this.getCreationSteps() : []),
      // ...this.getStartingSteps(),
    ];
  }

  private getDistance(stepId: StepId) {
    const { activeStep, doneSteps } = this.state;

    const isActive = activeStep === stepId;
    const isDone = doneSteps.includes(stepId);
    return isActive ? 0 : isDone ? 1 : -1;
  }

  private getCreationInitStep(): PF.WizardStep {
    const { history, searchParams } = this.props;
    const stepId = Step.INITIALIZE;
    console.debug('>>> this.getDistance(INITIALIZE)', this.getDistance(stepId));

    return {
      id: stepId,
      name: <StepName stepId={stepId} defaultName={CreatingStepInitialize.stepName} />,
      component: (
        <CreatingStepInitialize
          distance={this.getDistance(stepId)}
          history={history}
          onError={alertItem => this.handleShowStepAlert(stepId, alertItem)}
          onHideError={key => this.handleCloseStepAlert(key)}
          onNextStep={() => this.handleGoToNextStep(stepId)}
          onRestart={tab => this.handleRestartFlow(stepId, tab)}
          searchParams={searchParams}
          stepId={stepId}
        />
      ),
    };
  }

  private getStartingInitStep(): PF.WizardStep {
    const { history } = this.props;

    const loaderMode = getLoaderMode(history.location);
    const matchParams = loaderMode.mode === 'workspace' ? loaderMode.workspaceParams : undefined;

    const stepId = Step.INITIALIZE;
    return {
      id: stepId,
      name: <StepName stepId={stepId} defaultName={StartingStepInitialize.stepName} />,
      component: (
        <StartingStepInitialize
          distance={this.getDistance(stepId)}
          history={history}
          matchParams={matchParams}
          onError={alertItem => this.handleShowStepAlert(stepId, alertItem)}
          onHideError={key => this.handleCloseStepAlert(key)}
          onNextStep={() => this.handleGoToNextStep(stepId)}
          onRestart={tab => this.handleRestartFlow(stepId, tab)}
          stepId={stepId}
        />
      ),
    };
  }

  private getCommonSteps(): PF.WizardStep[] {
    const { history } = this.props;

    const loaderMode = getLoaderMode(history.location);
    const matchParams = loaderMode.mode === 'workspace' ? loaderMode.workspaceParams : undefined;

    const getCheckRunningWorkspaces = () => {
      const stepId = Step.CONFLICT_CHECK;
      console.debug('>>> this.getDistance(CONFLICT_CHECK)', this.getDistance(stepId));
      return {
        id: stepId,
        name: (
          <StepName stepId={stepId} defaultName={CommonStepCheckRunningWorkspacesLimit.stepName} />
        ),
        component: (
          <CommonStepCheckRunningWorkspacesLimit
            distance={this.getDistance(stepId)}
            history={history}
            matchParams={matchParams}
            onError={alertItem => this.handleShowStepAlert(stepId, alertItem)}
            onHideError={key => this.handleCloseStepAlert(key)}
            onNextStep={() => this.handleGoToNextStep(stepId)}
            onRestart={tab => this.handleRestartFlow(stepId, tab)}
            stepId={stepId}
          />
        ),
      };
    };
    return [getCheckRunningWorkspaces()];
  }

  private getCreationSteps(): PF.WizardStep[] {
    const { history, searchParams } = this.props;
    const { factoryParams } = this.state;

    const usePrebuiltResources = factoryParams.useDevworkspaceResources;
    const stepId = Step.CREATE;
    console.debug('>>> this.getDistance(CREATE)', this.getDistance(stepId));
    return [
      {
        id: stepId,
        name: <StepName stepId={stepId} defaultName={CreatingStepCreateWorkspace.stepName} />,
        component: (
          <CreatingStepCreateWorkspace
            distance={this.getDistance(stepId)}
            history={history}
            searchParams={searchParams}
            onError={alertItem => this.handleShowStepAlert(stepId, alertItem)}
            onHideError={key => this.handleCloseStepAlert(key)}
            onNextStep={() => this.handleGoToNextStep(stepId)}
            onRestart={tab => this.handleRestartFlow(stepId, tab)}
            stepId={stepId}
          />
        ),
        // steps: [
        //   usePrebuiltResources ? this.getFactoryFetchResources() : this.getFactoryFetchDevfile(),
        //   this.getCheckExistingWorkspaces(),
        //   // usePrebuiltResources ? this.getFactoryApplyResources() : this.getFactoryApplyDevfile(),
        // ],
      },
    ];
  }

  private getCheckExistingWorkspaces(): PF.WizardStep {
    const { history, searchParams } = this.props;

    const stepId = Step.CONFLICT_CHECK;
    return {
      id: stepId,
      name: <StepName stepId={stepId} defaultName={CreatingStepCheckExistingWorkspaces.stepName} />,
      component: (
        <CreatingStepCheckExistingWorkspaces
          distance={this.getDistance(stepId)}
          history={history}
          searchParams={searchParams}
          onError={alertItem => this.handleShowStepAlert(stepId, alertItem)}
          onHideError={alertId => this.handleCloseStepAlert(alertId)}
          onNextStep={() => this.handleGoToNextStep(stepId)}
          onRestart={tab => this.handleRestartFlow(stepId, tab)}
          stepId={stepId}
        />
      ),
    };
  }

  private getFactoryFetchResources(): PF.WizardStep {
    const { history, searchParams } = this.props;

    const stepId = Step.FETCH;
    return {
      id: stepId,
      name: <StepName stepId={stepId} defaultName={CreatingStepFetchResources.stepName} />,
      component: (
        <CreatingStepFetchResources
          distance={this.getDistance(stepId)}
          history={history}
          searchParams={searchParams}
          onError={alertItem => this.handleShowStepAlert(stepId, alertItem)}
          onHideError={key => this.handleCloseStepAlert(key)}
          onNextStep={() => this.handleGoToNextStep(stepId)}
          onRestart={tab => this.handleRestartFlow(stepId, tab)}
          stepId={stepId}
        />
      ),
    };
  }

  private getFactoryApplyResources(): PF.WizardStep {
    const { history, searchParams } = this.props;

    const stepId = Step.APPLY;
    return {
      id: stepId,
      name: <StepName stepId={stepId} defaultName={CreatingStepApplyResources.stepName} />,
      component: (
        <CreatingStepApplyResources
          distance={this.getDistance(stepId)}
          history={history}
          searchParams={searchParams}
          onError={alertItem => this.handleShowStepAlert(stepId, alertItem)}
          onHideError={key => this.handleCloseStepAlert(key)}
          onNextStep={() => this.handleGoToNextStep(stepId)}
          onRestart={tab => this.handleRestartFlow(stepId, tab)}
          stepId={stepId}
        />
      ),
    };
  }

  private getFactoryFetchDevfile(): PF.WizardStep {
    const { history, searchParams } = this.props;

    const stepId = Step.FETCH;
    return {
      id: stepId,
      name: <StepName stepId={stepId} defaultName={CreatingStepFetchDevfile.stepName} />,
      component: (
        <CreatingStepFetchDevfile
          distance={this.getDistance(stepId)}
          history={history}
          searchParams={searchParams}
          onError={alertItem => this.handleShowStepAlert(stepId, alertItem)}
          onHideError={key => this.handleCloseStepAlert(key)}
          onNextStep={() => this.handleGoToNextStep(stepId)}
          onRestart={tab => this.handleRestartFlow(stepId, tab)}
          stepId={stepId}
        />
      ),
    };
  }

  private getFactoryApplyDevfile(): PF.WizardStep {
    const { history, searchParams } = this.props;

    const stepId = Step.APPLY;
    return {
      id: stepId,
      name: <StepName stepId={stepId} defaultName={CreatingStepApplyDevfile.stepName} />,
      component: (
        <CreatingStepApplyDevfile
          distance={this.getDistance(stepId)}
          history={history}
          searchParams={searchParams}
          onError={alertItem => this.handleShowStepAlert(stepId, alertItem)}
          onHideError={key => this.handleCloseStepAlert(key)}
          onNextStep={() => this.handleGoToNextStep(stepId)}
          onRestart={tab => this.handleRestartFlow(stepId, tab)}
          stepId={stepId}
        />
      ),
    };
  }

  private getStartingSteps(): PF.WizardStep[] {
    const { history } = this.props;

    const loaderMode = getLoaderMode(history.location);

    const matchParams = loaderMode.mode === 'workspace' ? loaderMode.workspaceParams : undefined;

    const conditionSteps = this.buildConditionSteps();
    const steps = conditionSteps.length > 0 ? { steps: conditionSteps } : {};

    const getWorkspaceStart = () => {
      const stepId = Step.START;
      return {
        id: stepId,
        name: <StepName stepId={stepId} defaultName={StartingStepStartWorkspace.stepName} />,
        component: (
          <StartingStepStartWorkspace
            distance={this.getDistance(stepId)}
            onError={alertItem => this.handleShowStepAlert(stepId, alertItem)}
            onHideError={key => this.handleCloseStepAlert(key)}
            onNextStep={() => this.handleGoToNextStep(stepId)}
            onRestart={tab => this.handleRestartFlow(stepId, tab)}
            history={history}
            matchParams={matchParams}
            stepId={stepId}
          />
        ),
        ...steps,
      };
    };
    const getWorkspaceOpen = () => {
      const stepId = Step.OPEN;
      return {
        id: stepId,
        name: <StepName stepId={stepId} defaultName={StartingStepOpenWorkspace.stepName} />,
        component: (
          <StartingStepOpenWorkspace
            distance={this.getDistance(stepId)}
            onError={alertItem => this.handleShowStepAlert(stepId, alertItem)}
            onHideError={key => this.handleCloseStepAlert(key)}
            onNextStep={() => this.handleGoToNextStep(stepId)}
            onRestart={tab => this.handleRestartFlow(stepId, tab)}
            history={history}
            matchParams={matchParams}
            stepId={stepId}
          />
        ),
      };
    };

    return [getWorkspaceStart(), getWorkspaceOpen()];
  }

  private buildConditionSteps(): PF.WizardStep[] {
    const { history } = this.props;
    const { conditions } = this.state;
    const loaderMode = getLoaderMode(history.location);

    if (loaderMode.mode !== 'workspace') {
      return [];
    }

    return conditions.map(condition => {
      const stepId: ConditionStepId = `condition-${condition.type}`;
      const defaultName = condition.message || condition.type;
      return {
        id: stepId,
        name: <StepName stepId={stepId} defaultName={defaultName} />,
        component: (
          <StartingStepWorkspaceConditions
            distance={1}
            condition={condition as ConditionType}
            matchParams={loaderMode.workspaceParams}
            history={history}
            onError={alertItem => this.handleShowStepAlert(stepId, alertItem)}
            onHideError={key => this.handleCloseStepAlert(key)}
            onNextStep={() => this.handleGoToNextStep(stepId)}
            onRestart={tab => this.handleRestartFlow(stepId, tab)}
            stepId={stepId}
          />
        ),
      };
    });
  }

  private handleSwitchToNextStep(...params: Parameters<PF.WizardStepFunctionType>): void {
    const [newStep, prevStep] = params;

    const activeStep = newStep.id ? (newStep.id as Step) : this.state.activeStep;

    const doneSteps = prevStep.prevId
      ? [...this.state.doneSteps, prevStep.prevId as Step]
      : this.state.doneSteps;

    this.setState({
      activeStep,
      doneSteps,
    });
  }

  render(): React.ReactNode {
    const { showToastAlert } = this.props;
    const { alertItems } = this.state;

    const steps = this.getSteps();

    return (
      <React.Fragment>
        <ProgressAlert isToast={showToastAlert} alertItems={alertItems} />
        <PF.Wizard
          className={styles.progress}
          steps={steps}
          footer={<></>}
          ref={this.wizardRef}
          onNext={(...params) => this.handleSwitchToNextStep(...params)}
        />
      </React.Fragment>
    );
  }
}

const mapStateToProps = (state: AppState) => ({
  allWorkspaces: selectAllWorkspaces(state),
});

const connector = connect(
  mapStateToProps,
  {
    ...WorkspaceStore.actionCreators,
    ...storeWorkspaceProgress.actionCreators,
  },
  null,
  {
    // forwardRef is mandatory for using `@react-mock/state` in unit tests
    forwardRef: true,
  },
);
type MappedProps = ConnectedProps<typeof connector>;
export default connector(Progress);
