import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { v4 as uuidv4 } from "uuid";
import { LightSpeedAPI } from "./api";
import { TelemetryManager } from "../../utils/telemetryUtils";
import { SettingsManager } from "../../settings";
import { LightSpeedAuthenticationProvider } from "./lightSpeedOAuthProvider";
import {
  AnsibleContentUploadTrigger,
  FeedbackRequestParams,
  IDocumentTracker,
} from "../../definitions/lightspeed";
import { AttributionsWebview } from "./attributionsWebview";
import {
  ANSIBLE_LIGHTSPEED_AUTH_ID,
  ANSIBLE_LIGHTSPEED_AUTH_NAME,
} from "./utils/webUtils";
import { LightspeedStatusBar } from "./statusBar";

export class LightSpeedManager {
  private context;
  public client;
  public settingsManager: SettingsManager;
  public telemetry: TelemetryManager;
  public apiInstance: LightSpeedAPI;
  public lightSpeedAuthenticationProvider: LightSpeedAuthenticationProvider;
  public lightSpeedActivityTracker: IDocumentTracker;
  public attributionsProvider: AttributionsWebview;
  public statusBarProvider: LightspeedStatusBar;

  constructor(
    context: vscode.ExtensionContext,
    client: LanguageClient,
    settingsManager: SettingsManager,
    telemetry: TelemetryManager
  ) {
    this.context = context;
    this.client = client;
    this.settingsManager = settingsManager;
    this.telemetry = telemetry;
    this.lightSpeedActivityTracker = {};
    // initiate the OAuth service for Ansible Lightspeed
    this.lightSpeedAuthenticationProvider =
      new LightSpeedAuthenticationProvider(
        this.context,
        this.settingsManager,
        ANSIBLE_LIGHTSPEED_AUTH_ID,
        ANSIBLE_LIGHTSPEED_AUTH_NAME
      );
    if (this.settingsManager.settings.lightSpeedService.enabled) {
      this.lightSpeedAuthenticationProvider.initialize();
    }
    this.apiInstance = new LightSpeedAPI(
      this.settingsManager,
      this.lightSpeedAuthenticationProvider
    );
    this.attributionsProvider = new AttributionsWebview(
      this.context,
      this.client,
      this.settingsManager,
      this.apiInstance
    );

    // create a new project lightspeed status bar item that we can manage
    this.statusBarProvider = new LightspeedStatusBar(
      this.apiInstance,
      context,
      client,
      settingsManager
    );
  }

  public async reInitialize(): Promise<void> {
    const lightspeedEnabled = await vscode.workspace
      .getConfiguration("ansible")
      .get("lightspeed.enabled");

    if (!lightspeedEnabled) {
      await this.lightSpeedAuthenticationProvider.dispose();
      this.statusBarProvider.statusBar.hide();
      return;
    } else {
      this.lightSpeedAuthenticationProvider.initialize();
    }
  }

  public ansibleContentFeedback(
    document: vscode.TextDocument,
    trigger: AnsibleContentUploadTrigger
  ): void {
    if (
      document.languageId !== "ansible" ||
      !this.settingsManager.settings.lightSpeedService.enabled ||
      !this.settingsManager.settings.lightSpeedService.URL.trim()
    ) {
      return;
    }

    const currentFileContent = document.getText();
    const documentUri = document.uri.toString();
    let activityId: string;
    if (!this.lightSpeedActivityTracker.hasOwnProperty(documentUri)) {
      // Inline suggestion not yet triggered, return without sending event.
      return;
    }
    if (this.lightSpeedActivityTracker.hasOwnProperty(documentUri)) {
      activityId = this.lightSpeedActivityTracker[documentUri].activityId;
      const previousFileContent =
        this.lightSpeedActivityTracker[documentUri].content;

      if (trigger === AnsibleContentUploadTrigger.FILE_CLOSE) {
        // end previous activity tracker
        delete this.lightSpeedActivityTracker[documentUri];
      }

      if (previousFileContent === currentFileContent) {
        console.log(
          `[ansible-lightspeed-feedback] Event ansibleContent not sent as the content of file ${documentUri} is same as previous event.`
        );
        return;
      }

      if (trigger === AnsibleContentUploadTrigger.TAB_CHANGE) {
        // start a new activity tracker
        this.lightSpeedActivityTracker[documentUri].activityId = uuidv4();
      }
    } else {
      activityId = uuidv4();
      this.lightSpeedActivityTracker[documentUri] = {
        activityId: activityId,
        content: currentFileContent,
      };
    }

    if (!currentFileContent.trim()) {
      console.log(
        `[ansible-lightspeed-feedback] Event ansibleContent is not sent as the content of file ${documentUri} is empty.`
      );
      return;
    }

    const inputData: FeedbackRequestParams = {
      ansibleContent: {
        content: document.getText(),
        documentUri: documentUri,
        trigger: trigger,
        activityId: activityId,
      },
    };
    console.log("[ansible-lightspeed-feedback] Event ansibleContent sent.");
    this.apiInstance.feedbackRequest(inputData);
  }
}
