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

import { Wizard, WizardContext, WizardStep } from '@patternfly/react-core';
import { History } from 'history';
import React from 'react';
import { ConnectedProps, connect } from 'react-redux';
import { LoaderAlert } from '../../../components/Loader/Alert';
import findTargetWorkspace from '../../../containers/Loader/findTargetWorkspace';
import { LoaderMode, getLoaderMode } from '../../../containers/Loader/getLoaderMode';
import { AlertItem, DevWorkspaceStatus } from '../../../services/helpers/types';
import { AppState } from '../../../store';
import * as WorkspaceStore from '../../../store/Workspaces';
import { selectAllWorkspaces } from '../../../store/Workspaces/selectors';
import StepCheckRunningWorkspacesLimit from './CommonSteps/CheckRunningWorkspacesLimit';
import StepFactoryApplyDevfile from './Factory/Apply/Devfile';
import StepFactoryCreateWorkspace from './Factory/CreateWorkspace';
import StepFactoryFetchDevfile from './Factory/Fetch/Devfile';
import StepFactoryInitialize from './Factory/Initialize';
import WorkspaceStepInitialize from './Workspace/Initialize';
import WorkspaceStepOpenWorkspace from './Workspace/OpenWorkspace';
import WorkspaceStepStartWorkspace from './Workspace/StartWorkspace';
import WorkspaceStepCheckConditions from './Workspace/StartWorkspace/CheckConditions';

type Props = MappedProps & {
  history: History;
  searchParams: URLSearchParams;
  showToastAlert: boolean;
};
type State = {
  alertItem: AlertItem | undefined;
  initialLoaderMode: LoaderMode;
};

class TestProgress extends React.PureComponent<Props, State> {
  static contextType = WizardContext;
  readonly context: React.ContextType<typeof WizardContext>;

  private readonly wizardRef: React.RefObject<any>;

  constructor(props: Props) {
    super(props);
    this.wizardRef = React.createRef();

    const initialLoaderMode = getLoaderMode(props.history.location);

    this.state = {
      alertItem: undefined,
      initialLoaderMode,
    };
  }

  public componentDidUpdate(prevProps: Props): void {
    const { allWorkspaces, history, searchParams } = this.props;
    const workspace = allWorkspaces[0];
    console.debug('>>> workspace?.status.conditions', workspace?.ref.status?.conditions);
  }

  private handleError(alertItem: AlertItem): void {
    console.log('>>> handleError', alertItem);

    this.setState({
      alertItem,
    });
  }

  private handleNextStep(): void {
    console.warn('>>> handleNextStep');
    this.wizardRef.current?.onNext();
    console.debug('>>> this.wizardRef.current', this.wizardRef.current);
  }

  private handleRestart(): void {
    console.log('>>> handleRestart');
    // todo go to first step
  }

  private getSteps(): WizardStep[] {
    const { initialLoaderMode } = this.state;
    const showFactorySteps = initialLoaderMode.mode === 'factory';

    return [
      showFactorySteps ? this.getFactoryInitStep() : this.getWorkspaceInitStep(),
      ...this.getCommonSteps(),
      ...((showFactorySteps ? this.getFactorySteps() : []) as any),
      ...this.getWorkspaceSteps(),
    ];
  }

  private getFactoryInitStep(): WizardStep {
    const { history, searchParams } = this.props;

    return {
      name: 'Initialize Factory',
      component: (
        <StepFactoryInitialize
          history={history}
          searchParams={searchParams}
          onError={alertItem => this.handleError(alertItem)}
          onNextStep={() => this.handleNextStep()}
          onRestart={() => this.handleRestart()}
        />
      ),
    };
  }

  private getWorkspaceInitStep(): WizardStep {
    const { history } = this.props;

    const loaderMode = getLoaderMode(history.location);

    const matchParams = loaderMode.mode === 'workspace' ? loaderMode.workspaceParams : undefined;

    return {
      name: WorkspaceStepInitialize.buildTitle(),
      component: (
        <WorkspaceStepInitialize
          history={history}
          matchParams={matchParams}
          onError={alertItem => this.handleError(alertItem)}
          onNextStep={() => this.handleNextStep()}
          onRestart={() => this.handleRestart()}
        />
      ),
    };
  }

  private getCommonSteps(): WizardStep[] {
    const { history } = this.props;

    const loaderMode = getLoaderMode(history.location);

    const matchParams = loaderMode.mode === 'workspace' ? loaderMode.workspaceParams : undefined;

    return [
      {
        name: StepCheckRunningWorkspacesLimit.buildTitle(),
        component: (
          <StepCheckRunningWorkspacesLimit
            history={history}
            matchParams={matchParams}
            onError={alertItem => this.handleError(alertItem)}
            onNextStep={() => this.handleNextStep()}
            onRestart={() => this.handleRestart()}
          />
        ),
      },
    ];
  }

  private getFactorySteps(): WizardStep[] {
    const { history, searchParams } = this.props;

    return [
      {
        name: 'Fetch Devfile',
        component: (
          <StepFactoryFetchDevfile
            history={history}
            searchParams={searchParams}
            onError={alertItem => this.handleError(alertItem)}
            onNextStep={() => this.handleNextStep()}
            onRestart={() => this.handleRestart()}
          />
        ),
      },
      {
        name: StepFactoryCreateWorkspace.buildTitle(),
        component: (
          <StepFactoryCreateWorkspace
            history={history}
            searchParams={searchParams}
            onError={alertItem => this.handleError(alertItem)}
            onNextStep={() => this.handleNextStep()}
            onRestart={() => this.handleRestart()}
          />
        ),
      },
      {
        name: StepFactoryApplyDevfile.buildTitle(),
        component: (
          <StepFactoryApplyDevfile
            history={history}
            searchParams={searchParams}
            onError={alertItem => this.handleError(alertItem)}
            onNextStep={() => this.handleNextStep()}
            onRestart={() => this.handleRestart()}
          />
        ),
      },
    ];
  }

  private getWorkspaceSteps(): WizardStep[] {
    const { history } = this.props;

    const loaderMode = getLoaderMode(history.location);

    const matchParams = loaderMode.mode === 'workspace' ? loaderMode.workspaceParams : undefined;

    const conditionSteps = this.buildConditionSteps();
    console.debug('>>> conditionSteps', conditionSteps);
    const steps = conditionSteps.length > 0 ? { steps: conditionSteps } : {};

    return [
      {
        name: WorkspaceStepStartWorkspace.buildTitle(),
        component: (
          <WorkspaceStepStartWorkspace
            onError={alertItem => this.handleError(alertItem)}
            onNextStep={() => this.handleNextStep()}
            onRestart={() => this.handleRestart()}
            history={history}
            matchParams={matchParams}
          />
        ),
        ...steps,
      },
      // ...conditionSteps,
      {
        name: WorkspaceStepOpenWorkspace.buildTitle(),
        component: (
          <WorkspaceStepOpenWorkspace
            onError={alertItem => this.handleError(alertItem)}
            onNextStep={() => this.handleNextStep()}
            onRestart={() => this.handleRestart()}
            history={history}
            matchParams={matchParams}
          />
        ),
      },
    ];
  }

  private buildConditionSteps(): WizardStep[] {
    const { allWorkspaces, history } = this.props;
    const loaderMode = getLoaderMode(history.location);

    if (loaderMode.mode !== 'workspace') {
      return [];
    }

    const workspace = findTargetWorkspace(allWorkspaces, loaderMode.workspaceParams);
    if (workspace === undefined || workspace.status !== DevWorkspaceStatus.STARTING) {
      return [];
    }

    return (workspace.ref.status?.conditions || [])
      .filter(condition => condition.message)
      .map(condition => {
        const name = condition.message;
        return {
          component: (
            <WorkspaceStepCheckConditions
              condition={condition}
              matchParams={loaderMode.workspaceParams}
              history={history}
              onError={alertItem => this.handleError(alertItem)}
              onNextStep={() => this.handleNextStep()}
              onRestart={() => this.handleRestart()}
            />
          ),
          name: <div className="conditionStep">{name}</div>,
        };
      });
  }

  render(): React.ReactNode {
    const { showToastAlert } = this.props;
    const { alertItem } = this.state;

    const steps = this.getSteps();

    return (
      <div>
        Test Progress
        <LoaderAlert isToast={showToastAlert} alertItem={alertItem} />
        <Wizard steps={steps} footer={<span />} height={500} ref={this.wizardRef} />
      </div>
    );
  }
}

const mapStateToProps = (state: AppState) => ({
  allWorkspaces: selectAllWorkspaces(state),
});

const connector = connect(mapStateToProps, WorkspaceStore.actionCreators, null, {
  // forwardRef is mandatory for using `@react-mock/state` in unit tests
  forwardRef: true,
});
type MappedProps = ConnectedProps<typeof connector>;
export default connector(TestProgress);
