/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { InteractionRequiredAuthError, InteractionType } from "@azure/msal-browser";
import { Client } from '@microsoft/microsoft-graph-client';

import { msalInstance } from "./index";

/**
 * This class implements the IAuthenticationProvider interface, which allows a custom auth provider to be
 * used with the Graph client. See: https://github.com/microsoftgraph/msgraph-sdk-javascript/blob/dev/src/IAuthenticationProvider.ts
 */
class MyAuthenticationProvider {

    userAccount;
    requiredScopes;
    interactionType;

    /**
     * @param {object} userAccount: user account object to be used when attempting silent token acquisition  
     * @param {array} requiredScopes: array of scopes required for this resource endpoint
     * @param {string} interactionType: type of interaction to fallback to when silent token acquisition fails 
     */
    constructor(userAccount, requiredScopes, interactionType) {
        this.userAccount = userAccount;
        this.requiredScopes = requiredScopes;
        this.interactionType = interactionType;
    }

    /**
     * This method will get called before every request to the ms graph server
     * This should return a Promise that resolves to an accessToken (in case of success) or rejects with error (in case of failure)
     * Basically this method will contain the implementation for getting and refreshing accessTokens
     */
    getAccessToken() {
        return new Promise(async (resolve, reject) => {
            const account = msalInstance.getActiveAccount();
            let response;

            if (!account) {
                throw Error("No active account! Verify a user has been signed in and setActiveAccount has been called.");
            }

            try {
                response = await msalInstance.acquireTokenSilent({
                    account: this.userAccount,
                    scopes: this.requiredScopes
                });
            } catch (error) {
                // in case if silent token acquisition fails, fallback to an interactive method
                if (error instanceof InteractionRequiredAuthError) {
                    switch (this.interactionType) {
                        case InteractionType.Popup:

                            response = await msalInstance.acquireTokenPopup({
                                scopes: this.requiredScopes
                            });
                            break;

                        case InteractionType.Redirect:
                            response = await msalInstance.acquireTokenRedirect({
                                scopes: this.requiredScopes
                            });
                            break;

                        default:
                            break;
                    }
                }
            }

            if (response.accessToken) {
                resolve(response.accessToken);
            } else {
                reject(Error('Failed to acquire an access token'));
            }
        });
    }
}

/**
 * Returns a graph client object with the provided token acquisition options
 * @param {object} userAccount: user account object to be used when attempting silent token acquisition  
 * @param {array} requiredScopes: array of scopes required for this resource endpoint
 * @param {string} interactionType: type of interaction to fallback to when silent token acquisition fails 
 */
export const getGraphClient = (userAccount, requiredScopes, interactionType) => {

    /**
     * Pass the instance as authProvider in ClientOptions to instantiate the Client which will create and set the default middleware chain.
     * For more information, visit: https://github.com/microsoftgraph/msgraph-sdk-javascript/blob/dev/docs/CreatingClientInstance.md
     */
    let clientOptions = {
        authProvider: new MyAuthenticationProvider(userAccount, requiredScopes, interactionType),
    };

    const graphClient = Client.initWithMiddleware(clientOptions);

    return graphClient;
}