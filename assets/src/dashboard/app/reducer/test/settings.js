/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Internal dependencies
 */
import settingsReducer, { ACTION_TYPES } from '../settings';

describe('settingsReducer', () => {
  const initialState = {
    error: {},
    googleAnalyticsId: null,
  };

  beforeAll(() => {
    jest.spyOn(Date, 'now').mockImplementation(() => 1592844570916);
  });

  it(`should update settings state when ${ACTION_TYPES.FETCH_SETTINGS_SUCCESS} is called`, () => {
    const result = settingsReducer(initialState, {
      type: ACTION_TYPES.FETCH_SETTINGS_SUCCESS,
      payload: { googleAnalyticsId: 'fakeId12345' },
    });
    expect(result).toMatchObject({
      error: {},
      googleAnalyticsId: 'fakeId12345',
    });
  });

  it(`should update settings state when ${ACTION_TYPES.FETCH_SETTINGS_FAILURE} is called`, () => {
    const result = settingsReducer(initialState, {
      type: ACTION_TYPES.FETCH_SETTINGS_FAILURE,
      payload: {
        message: {
          body: 'The response is not a valid JSON response.',
          title: 'Unable to find settings data',
        },
        code: 'my_error_code',
      },
    });
    expect(result).toMatchObject({
      googleAnalyticsId: null,
      error: {
        message: {
          body: 'The response is not a valid JSON response.',
          title: 'Unable to find settings data',
        },
        id: Date.now(),
        code: 'my_error_code',
      },
    });
  });

  it(`should update settings state when ${ACTION_TYPES.UPDATE_SETTINGS_FAILURE} is called`, () => {
    const result = settingsReducer(initialState, {
      type: ACTION_TYPES.UPDATE_SETTINGS_FAILURE,
      payload: {
        message: {
          body: 'The response is not a valid JSON response.',
          title: 'Unable to update settings data',
        },
        code: 'my_error_code',
      },
    });
    expect(result).toMatchObject({
      googleAnalyticsId: null,
      error: {
        message: {
          body: 'The response is not a valid JSON response.',
          title: 'Unable to update settings data',
        },
        id: Date.now(),
        code: 'my_error_code',
      },
    });
  });

  it(`should update settings state when ${ACTION_TYPES.UPDATE_SETTINGS_SUCCESS} is called`, () => {
    const result = settingsReducer(initialState, {
      type: ACTION_TYPES.FETCH_SETTINGS_SUCCESS,
      payload: { googleAnalyticsId: 'fakeId12345NEW' },
    });
    expect(result).toMatchObject({
      error: {},
      googleAnalyticsId: 'fakeId12345NEW',
    });
  });
});
