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
import styled from 'styled-components';
import PropTypes from 'prop-types';
import { useCallback, useRef, useEffect } from 'react';
import { rgba } from 'polished';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import useInspector from '../../../inspector/useInspector';
import panelContext from '../context';
import { Arrow } from '../../../../icons';
import { PANEL_COLLAPSED_THRESHOLD } from '../panel';
import { useContext } from '../../../../utils/context';
import { useKeyDownEffect } from '../../../keyboard';
import DragHandle from './handle';

function getBackgroundColor(isPrimary, isSecondary, theme) {
  if (isPrimary) {
    return rgba(theme.colors.bg.black, 0.07);
  }
  if (isSecondary) {
    return rgba(theme.colors.fg.white, 0.07);
  }
  return 'transparent';
}

const Header = styled.h2`
  background-color: ${({ isPrimary, isSecondary, theme }) =>
    getBackgroundColor(isPrimary, isSecondary, theme)};
  border: 0 solid ${({ theme }) => rgba(theme.colors.fg.gray16, 0.6)};
  border-top-width: ${({ isPrimary, isSecondary }) =>
    isPrimary || isSecondary ? 0 : '1px'};
  color: ${({ theme }) => rgba(theme.colors.fg.white, 0.84)};
  ${({ hasResizeHandle }) => hasResizeHandle && 'padding-top: 0;'}
  margin: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  user-select: none;
`;

const HeaderButton = styled.div.attrs({ role: 'button' })`
  color: inherit;
  padding: 10px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
`;

const Heading = styled.span`
  color: inherit;
  margin: 0;
  font-weight: 500;
  font-size: 14px;
  line-height: 19px;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
`;

const Collapse = styled.button`
  border: none;
  background: transparent;
  color: inherit;
  width: 28px;
  height: 28px;
  display: flex; /* removes implicit line-height padding from child element */
  padding: 0;
  cursor: pointer;
  svg {
    width: 28px;
    height: 28px;
    ${({ isCollapsed }) => isCollapsed && `transform: rotate(.5turn);`}
  }
`;

function Toggle({ children, toggle, ...rest }) {
  // We unfortunately have to manually assign this listener, as it would be default behaviour
  // if it wasn't for our listener further up the stack interpreting enter as "enter edit mode"
  // for text elements. For non-text element selection, this does nothing, that default beviour
  // wouldn't do.
  const ref = useRef();
  useKeyDownEffect(ref, 'enter', toggle, [toggle]);
  return (
    <Collapse
      ref={ref}
      onClick={(evt) => {
        evt.stopPropagation();
        toggle();
      }}
      {...rest}
    >
      {children}
    </Collapse>
  );
}

Toggle.propTypes = {
  children: PropTypes.node.isRequired,
  toggle: PropTypes.func.isRequired,
};

function Title({
  children,
  isPrimary,
  isSecondary,
  secondaryAction,
  isResizable,
  canCollapse,
}) {
  const {
    state: { isCollapsed, height, resizeable, panelContentId, panelTitleId },
    actions: {
      collapse,
      expand,
      setHeight,
      setExpandToHeight,
      resetHeight,
      confirmTitle,
    },
  } = useContext(panelContext);
  const {
    state: { inspectorContentHeight },
  } = useInspector();

  useEffect(confirmTitle, [confirmTitle]);

  // Max panel height is set to 70% of full available height.
  const maxHeight = Math.round(inspectorContentHeight * 0.7);

  const handleHeightChange = useCallback(
    (deltaHeight) =>
      resizeable
        ? setHeight((value) =>
            Math.max(0, Math.min(maxHeight, value + deltaHeight))
          )
        : null,
    [resizeable, setHeight, maxHeight]
  );

  const handleExpandToHeightChange = useCallback(() => {
    if (resizeable && height >= PANEL_COLLAPSED_THRESHOLD) {
      setExpandToHeight(height);
    }
  }, [setExpandToHeight, height, resizeable]);

  const titleLabel = isCollapsed
    ? __('Expand panel', 'web-stories')
    : __('Collapse panel', 'web-stories');

  const toggle = isCollapsed ? expand : collapse;

  return (
    <Header
      isPrimary={isPrimary}
      isSecondary={isSecondary}
      hasResizeHandle={isResizable && !isCollapsed}
    >
      {isResizable && (
        <DragHandle
          height={height}
          minHeight={0}
          maxHeight={maxHeight}
          handleHeightChange={handleHeightChange}
          handleExpandToHeightChange={handleExpandToHeightChange}
          handleDoubleClick={resetHeight}
        />
      )}
      <HeaderButton onClick={toggle}>
        <Heading id={panelTitleId}>{children}</Heading>
        <HeaderActions>
          {secondaryAction}
          {canCollapse && (
            <Toggle
              isCollapsed={isCollapsed}
              toggle={toggle}
              aria-label={titleLabel}
              aria-expanded={!isCollapsed}
              aria-controls={panelContentId}
            >
              <Arrow />
            </Toggle>
          )}
        </HeaderActions>
      </HeaderButton>
    </Header>
  );
}

Title.propTypes = {
  children: PropTypes.node,
  isPrimary: PropTypes.bool,
  isSecondary: PropTypes.bool,
  isResizable: PropTypes.bool,
  secondaryAction: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
  canCollapse: PropTypes.bool,
};

Title.defaultProps = {
  isPrimary: false,
  isSecondary: false,
  isResizable: false,
  canCollapse: true,
};

export default Title;
