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
 * External dependencies
 */
import React, { useCallback, useState, useMemo, forwardRef } from 'react';
import { FlagsProvider } from 'flagged';
import { render, act } from '@testing-library/react';

/**
 * Internal dependencies
 */
import App from '../app/index';
import APIProvider from '../app/api/apiProvider';
import APIContext from '../app/api/context';
import { TEXT_ELEMENT_DEFAULT_FONT } from '../app/font/defaultFonts';
import { WorkspaceLayout } from '../components/workspace/layout';
import FixtureEvents from './fixtureEvents';

const DEFAULT_CONFIG = {
  storyId: 1,
  api: {},
  allowedMimeTypes: {
    image: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'],
    video: ['video/mp4'],
  },
  allowedFileTypes: ['png', 'jpeg', 'jpg', 'gif', 'mp4'],
  capabilities: {},
};

/**
 * The fixture mainly follows the `@testing-library/react` library pattern, but
 * in the scope of the whole editor and the real browser. As such:
 *
 * - Call `set` and `stub` methods to configure the fixture before calling
 * the `render()` method.
 * - Call the `fixture.render()` method similarly to the
 * `@testing-library/react`'s `render()` before doing the actual tests.
 * - Call the `fixture.renderHook()` method similarly to the
 * `@testing-library/react`'s `renderHook()` to render a hook in the context
 * of the whole editor. A more fine-grained `renderHook()` can also be called
 * on a component stub. See the `fixture.stubComponent()` for more info.
 * - Call the `await fixture.act()` method similarly to the
 * `@testing-library/react`'s `act()` method for any action. Notice that events
 * automatically use `act()` internally.
 * - Call the `await fixture.events` methods to drive the events similarly
 * to the `@testing-library/react`'s `fireEvent`, except that these events will
 * be executed natively in the browser.
 */
export class Fixture {
  constructor() {
    this._config = { ...DEFAULT_CONFIG };

    this._flags = {};

    this._componentStubs = new Map();
    const origCreateElement = React.createElement;
    spyOn(React, 'createElement').and.callFake((type, props, ...children) => {
      if (!props?._wrapped) {
        const stubs = this._componentStubs.get(type);
        if (stubs) {
          const match = stubs.find((stub) => {
            if (!stub._matcher) {
              return true;
            }
            return stub._matcher(props);
          });
          if (match) {
            type = match._wrapper;
          }
        }
      }
      return origCreateElement(type, props, ...children);
    });

    this.apiProviderFixture_ = new APIProviderFixture();
    this.stubComponent(APIProvider).callFake(
      this.apiProviderFixture_.Component
    );

    this._layoutStub = this.stubComponent(WorkspaceLayout);

    this._events = new FixtureEvents(this.act.bind(this));

    this._container = null;
  }

  restore() {}

  get container() {
    return this._container;
  }

  /**
   * A fixture utility to fire native browser events. See `FixtureEvents` for
   * more info.
   *
   * @return {FixtureEvents} fixture events that are executed on the native
   * browser.
   */
  get events() {
    return this._events;
  }

  /**
   * Stubs a component. Can be used to render hooks on this component's level
   * or even to completely replace the implementation of the component.
   *
   * All components must be stubbed before the `fixture.render()` is called.
   *
   * Use sparingly. See `ComponentStub` for more info.
   *
   * @param {Function} component
   * @param {Function|undefined} matcher
   * @return {ComponentStub} The component's stub.
   */
  stubComponent(component, matcher) {
    const stub = new ComponentStub(this, component, matcher);
    let stubs = this._componentStubs.get(component);
    if (!stubs) {
      stubs = [];
      this._componentStubs.set(component, stubs);
    }
    stubs.push(stub);
    return stub;
  }

  /**
   * Set the feature flags. See `flags.js` for the list of flags.
   *
   * For instance, to enable a flag in your test call `setFlags` before
   * calling the `render()` method:
   * ```
   * beforeEach(async () => {
   *   fixture = new Fixture();
   *   fixture.setFlags({mediaDropdownMenu: true});
   *   await fixture.render();
   * });
   * ```
   *
   * @param {Object} flags
   */
  setFlags(flags) {
    this._flags = { ...flags };
  }

  /**
   * Renders the editor similarly to the `@testing-library/react`'s `render()`
   * method.
   *
   * @return {Promise} Yields when the editor rendering is complete.
   */
  render() {
    const { container } = render(
      <FlagsProvider features={this._flags}>
        <App key={Math.random()} config={this._config} />
      </FlagsProvider>
    );
    // The editor should always be given 100%:100% size. The testing-library
    // renders an extra container so it should be given the same size.
    container.style.width = '100%';
    container.style.height = '100%';
    this._container = container;

    // @todo: find a stable way to wait for the story to fully render. Can be
    // implemented via `waitFor`.
    return Promise.resolve();
  }

  /**
   * Calls a hook in the context of the whole editor.
   *
   * Similar to the `@testing-library/react`'s `renderHook()` method.
   *
   * @param {Function} func The hook function. E.g. `useStory`.
   * @return {Promise<Object>} Resolves when the hook is rendered with the
   * value of the hook.
   */
  renderHook(func) {
    return this._layoutStub.renderHook(func);
  }

  /**
   * Calls the specified callback and performs rendering actions on the
   * whole editor.
   *
   * Similar to the `@testing-library/react`'s `act()` method.
   *
   * @param {Function} callback
   * @return {Promise<Object>} Yields when the `act()` and all related
   * editor rendering activity is complete. Resolves to the result of the
   * callback.
   */
  act(callback) {
    return actPromise(callback);
  }

  /**
   * To be deprecated.
   *
   * @param {string} selector
   * @return {Element|null} The found element or null.
   */
  querySelector(selector) {
    return this._container.querySelector(selector);
  }

  /**
   * Makes a DOM snapshot of the current editor state. Karma must be run
   * with the `--snapshots` option for the snapshotting to be enabled. When
   * enabled, all snapshots are stored in the `/.test_artifacts/karma_snapshots`
   * directory.
   *
   * @param {string} name
   * @return {Promise} Yields when the snapshot is completed.
   */
  snapshot(name) {
    return karmaSnapshot(name);
  }
}

/**
 * A component stub. Allows two main features:
 * 1. Mock a component's implementation.
 * 2. Execute a hook against a component.
 */
class ComponentStub {
  constructor(fixture, Component, matcher) {
    this._fixture = fixture;
    this._matcher = matcher;
    this._implementation = null;

    this._props = null;

    let setRefresher;
    this._refresh = () => {
      act(() => {
        if (setRefresher) {
          setRefresher((v) => v + 1);
        }
      });
    };

    const pendingHooks = [];
    this._pushPendingHook = (func) => {
      let resolver;
      const promise = new Promise((resolve) => {
        resolver = resolve;
      });
      pendingHooks.push(() => {
        const result = func();
        resolver(result);
      });
      this._refresh();
      return promise;
    };

    const Wrapper = forwardRef((props, ref) => {
      this._props = props;

      const [refresher, setRefresherInternal] = useState(0);
      setRefresher = setRefresherInternal;
      const hooks = useMemo(
        () => {
          const hooksToExecute = pendingHooks.slice(0);
          pendingHooks.length = 0;
          return hooksToExecute;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [refresher]
      );

      const Impl = useMemo(
        () => {
          if (this._implementation) {
            const MockImpl = forwardRef((fProps, fRef) =>
              this._implementation(fProps, fRef)
            );
            MockImpl.displayName = `Stub(${
              Component.displayName || Component.name || ''
            })`;
            return MockImpl;
          }
          return Component;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [refresher]
      );

      return (
        <HookExecutor key={refresher} hooks={hooks}>
          <Impl _wrapped={true} ref={ref} {...props} />
        </HookExecutor>
      );
    });
    Wrapper.displayName = `Mock(${
      Component.displayName || Component.name || ''
    })`;
    this._wrapper = Wrapper;
  }

  get and() {
    return this;
  }

  get props() {
    return this._props;
  }

  mockImplementation(implementation) {
    this._implementation = implementation;
    this._refresh();
    return this;
  }

  callFake(implementation) {
    return this.mockImplementation(implementation);
  }

  renderHook(func) {
    return this._fixture.act(() => this._pushPendingHook(func));
  }
}

function HookExecutor({ hooks, children }) {
  hooks.forEach((func) => func());
  return children;
}

class APIProviderFixture {
  constructor() {
    // eslint-disable-next-line react/prop-types
    const Comp = ({ children }) => {
      const getStoryById = useCallback(
        // @todo: put this to __db__/
        () =>
          asyncResponse({
            title: { raw: 'Auto Draft' },
            status: 'draft',
            author: 1,
            slug: '',
            date_gmt: '2020-05-06T22:32:37',
            modified: '2020-05-06T22:32:37',
            excerpt: { raw: '' },
            link: 'http://stories.local/?post_type=web-story&p=1',
            story_data: [],
            featured_media: 0,
            featured_media_url: '',
            publisher_logo_url:
              'http://stories.local/wp-content/plugins/web-stories/assets/images/logo.png',
            permalink_template: 'http://stories3.local/stories/%pagename%/',
            style_presets: { textStyles: [], fillColors: [], textColors: [] },
            password: '',
          }),
        []
      );

      const autoSaveById = useCallback(
        () => jasmine.createSpy('autoSaveById'),
        []
      );
      const saveStoryById = useCallback(
        () => jasmine.createSpy('saveStoryById'),
        []
      );
      const deleteStoryById = useCallback(
        () => jasmine.createSpy('deleteStoryById'),
        []
      );

      const getAllFonts = useCallback(() => {
        // @todo: put actual data to __db__/
        return asyncResponse(
          [TEXT_ELEMENT_DEFAULT_FONT].map((font) => ({
            name: font.family,
            value: font.family,
            ...font,
          }))
        );
      }, []);

      // eslint-disable-next-line no-unused-vars
      const getMedia = useCallback(({ mediaType, searchTerm, pagingNum }) => {
        // @todo: arg support
        // @todo: put actual data to __db__/
        return asyncResponse({ data: [], headers: {} });
      }, []);
      const uploadMedia = useCallback(
        () => jasmine.createSpy('uploadMedia'),
        []
      );
      const updateMedia = useCallback(
        () => jasmine.createSpy('updateMedia'),
        []
      );

      const getLinkMetadata = useCallback(
        () => jasmine.createSpy('getLinkMetadata'),
        []
      );

      const getAllStatuses = useCallback(
        () => jasmine.createSpy('getAllStatuses'),
        []
      );
      const getAllUsers = useCallback(
        () => jasmine.createSpy('getAllUsers'),
        []
      );

      const state = {
        actions: {
          autoSaveById,
          getStoryById,
          getMedia,
          getLinkMetadata,
          saveStoryById,
          deleteStoryById,
          getAllFonts,
          getAllStatuses,
          getAllUsers,
          uploadMedia,
          updateMedia,
        },
      };
      return (
        <APIContext.Provider value={state}>{children}</APIContext.Provider>
      );
    };
    Comp.displayName = 'Fixture(APIProvider)';
    this._comp = Comp;
  }

  get Component() {
    return this._comp;
  }
}

/**
 * Wraps a fixture response in a promise. May additionally add `act()` calls as
 * needed.
 *
 * @param {*} value The reponse value.
 * @return {!Promise} The promise of the response.
 */
function asyncResponse(value) {
  return Promise.resolve(value);
}

/**
 * For integration fixture tests we want `act()` to be always async, otherwise
 * a tester would never know what to expect: switching from sync to async
 * is often an implementation detail.
 *
 * See https://github.com/facebook/react/blob/master/packages/react-dom/src/test-utils/ReactTestUtilsAct.js.
 *
 * @param {function():(!Promise|undefined)} callback The body of the `act()`.
 * @return {!Promise} The `act()` promise.
 */
function actPromise(callback) {
  return new Promise((resolve) => {
    let callbackResult;
    const actResult = act(() => {
      callbackResult = callback();
      return Promise.resolve(callbackResult);
    });
    resolve(
      new Promise((aResolve, aReject) => {
        actResult.then(aResolve, aReject);
      }).then(() => callbackResult)
    );
  });
}
