import {
  ConfirmPrompt,
  DialogSet,
  DialogTurnStatus,
  OAuthPrompt,
  WaterfallDialog,
  TextPrompt
} from "botbuilder-dialogs";

import LogoutDialog from "./logoutDialog";

const CONFIRM_PROMPT = "ConfirmPrompt";
const MAIN_DIALOG = "MainDialog";
const MAIN_WATERFALL_DIALOG = "MainWaterfallDialog";
const OAUTH_PROMPT = "OAuthPrompt";
const ALMOND_DIALOG = "AlmondDialog";
const ALMOND_TEXT_PROMPT = "AlmondTextPrompt";

export default class MainDialog extends LogoutDialog {
  private dialogState;

  constructor() {
    super(MAIN_DIALOG, process.env.connectionName);

    this.addDialog(
      new OAuthPrompt(OAUTH_PROMPT, {
        connectionName: process.env.connectionName,
        text: "Please Sign In",
        title: "Sign In",
        timeout: 300000
      })
    );
    this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
    this.addDialog(
      new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
        this.promptStep.bind(this),
        this.loginStep.bind(this)
      ])
    );
    this.addDialog(
      new WaterfallDialog(ALMOND_DIALOG, [
        this.commandStep.bind(this),
        this.almondStep.bind(this)
      ])
    );
    this.addDialog(new TextPrompt(ALMOND_TEXT_PROMPT));

    this.initialDialogId = MAIN_WATERFALL_DIALOG;
  }

  /**
   * The run method handles the incoming activity (in the form of a DialogContext) and passes it through the dialog system.
   * If no dialog is active, it will start the default dialog.
   * @param {*} dialogContext
   */
  public async run(context, accessor) {
    this.dialogState = accessor;

    const dialogSet = new DialogSet(accessor);
    dialogSet.add(this);

    const dialogContext = await dialogSet.createContext(context);
    const results = await dialogContext.continueDialog();
    if (results.status === DialogTurnStatus.empty) {
      await dialogContext.beginDialog(this.id);
    }
  }

  public async promptStep(stepContext) {
    return await stepContext.beginDialog(OAUTH_PROMPT);
  }

  public async loginStep(stepContext) {
    // Get the token from the previous step. Note that we could also have gotten the
    // token directly from the prompt itself. There is an example of this in the next method.
    const tokenResponse = stepContext.result;
    if (!tokenResponse) {
      await stepContext.context.sendActivity(
        "Login was not successful please try again."
      );
      return await stepContext.endDialog();
    }

    // save token in state
    this.dialogState.authToken = tokenResponse.token;

    await stepContext.context.sendActivity("You are now logged in.");
    await stepContext.context.sendActivity("What can I do for you?");

    return await stepContext.beginDialog(ALMOND_DIALOG);
  }

  public async commandStep(stepContext) {
    return await stepContext.prompt(ALMOND_TEXT_PROMPT);
  }

  public async almondStep(stepContext) {
    // Query Almond Server and return result

    await stepContext.context.sendActivity(stepContext.result);
    return await stepContext.replaceDialog(ALMOND_DIALOG);
  }

  public async displayTokenPhase1(stepContext) {
    await stepContext.context.sendActivity("Thank you.");

    const result = stepContext.result;
    if (result) {
      // Call the prompt again because we need the token. The reasons for this are:
      // 1. If the user is already logged in we do not need to store the token locally in the bot and worry
      // about refreshing it. We can always just call the prompt again to get the token.
      // 2. We never know how long it will take a user to respond. By the time the
      // user responds the token may have expired. The user would then be prompted to login again.
      //
      // There is no reason to store the token locally in the bot because we can always just call
      // the OAuth prompt to get the token or get a new token if needed.
      return await stepContext.beginDialog(OAUTH_PROMPT);
    }
    return await stepContext.endDialog();
  }

  public async displayTokenPhase2(stepContext) {
    const tokenResponse = stepContext.result;
    if (tokenResponse) {
      await stepContext.context.sendActivity(
        `Here is your token ${tokenResponse.token}`
      );
    }
    return await stepContext.endDialog();
  }
}