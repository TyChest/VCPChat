/**
 * AdvancedPromptEditor.js
 *
 * 高级系统提示词编辑器，支持划词选择、禁用/隐藏文字、拖拽插入等功能
 */

class AdvancedPromptEditor {
    constructor(containerElement) {
        this.container = containerElement;
        this.fragments = []; // 文本片段数组
        this.hiddenElements = []; // 隐藏元素数组
        this.nextFragmentId = 1;
        this.nextHiddenId = 1;
        this.pendingSelectedText = null; // 待处理的选中文字
        this.pendingSelectionRange = null; // 待处理的选中范围

        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        // 确保所有隐藏元素都有正确的颜色属性
        this.updateHiddenElementColors();
        console.log('[AdvancedPromptEditor] Initialized with color support');
    }

    // 确保隐藏元素有正确的颜色属性
    ensureHiddenElementColors() {
        this.hiddenElements.forEach(element => {
            if (!element.bubbleColor) {
                element.bubbleColor = '#3B82F6';
            }
            if (!element.textColor) {
                element.textColor = '#FFFFFF';
            }
        });
    }

    init() {
        this.createUI();
        this.bindEvents();
    }

    createUI() {
        this.container.innerHTML = `
            <div class="advanced-prompt-editor">
                <div class="editor-toolbar">
                    <button type="button" class="toolbar-btn" id="disableBtn" title="禁用选中的文字">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                        禁用
                    </button>
                    <button type="button" class="toolbar-btn" id="hideBtn" title="隐藏选中的文字">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                        隐藏
                    </button>
                    <button type="button" class="toolbar-btn" id="enableBtn" title="启用选中的禁用文字">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        启用
                    </button>
                </div>
                <div class="editor-main">
                    <div class="text-editor-container">
                        <div class="text-editor" contenteditable="true" spellcheck="false"></div>
                    </div>
                    <div class="hidden-elements-bar">
                        <div class="hidden-elements-label">隐藏元素:</div>
                        <div class="hidden-elements-container" id="hiddenElementsContainer">
                            <!-- 隐藏的小圆点将在这里显示 -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.textEditor = this.container.querySelector('.text-editor');
        this.hiddenElementsContainer = this.container.querySelector('#hiddenElementsContainer');
        this.toolbarBtns = {
            disable: this.container.querySelector('#disableBtn'),
            hide: this.container.querySelector('#hideBtn'),
            enable: this.container.querySelector('#enableBtn')
        };
    }

    bindEvents() {
        // 文本编辑器事件
        this.textEditor.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        this.textEditor.addEventListener('mouseup', () => this.updateToolbarState());
        this.textEditor.addEventListener('keyup', () => this.updateToolbarState());
        this.textEditor.addEventListener('input', () => this.handleTextInput());
        this.textEditor.addEventListener('paste', (e) => this.handlePaste(e));
        this.textEditor.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.textEditor.addEventListener('beforeinput', (e) => this.handleBeforeInput(e));

        // 工具栏按钮事件
        this.toolbarBtns.disable.addEventListener('click', () => this.disableSelectedText());
        this.toolbarBtns.hide.addEventListener('click', () => this.hideSelectedText());
        this.toolbarBtns.enable.addEventListener('click', () => this.enableSelectedText());

        // 隐藏元素容器拖拽事件
        this.hiddenElementsContainer.addEventListener('dragover', (e) => e.preventDefault());
        this.hiddenElementsContainer.addEventListener('drop', (e) => this.handleHiddenElementDrop(e));

        // 隐藏元素容器右键菜单（防止冒泡到编辑器右键菜单）
        this.hiddenElementsContainer.addEventListener('contextmenu', (e) => {
            // 如果点击的是隐藏元素，不阻止冒泡，让元素处理右键菜单
            if (e.target.classList.contains('hidden-element-dot')) {
                return;
            }
            e.stopPropagation();
        });

        // 全局点击事件，用于隐藏上下文菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.advanced-prompt-editor')) {
                this.hideContextMenu();
            }
        });
    }

    handleContextMenu(e) {
        e.preventDefault();
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText) {
            this.showContextMenu(e.clientX, e.clientY, selectedText);
        } else {
            // 检查是否点击在禁用文字上
            const target = e.target;
            if (target.classList.contains('disabled-text')) {
                this.showDisabledTextMenu(e.clientX, e.clientY, target);
            }
        }
    }

    showContextMenu(x, y, selectedText) {
        this.hideContextMenu();

        // 保存选中的文字和范围，供菜单操作使用
        this.pendingSelectedText = selectedText;
        this.pendingSelectionRange = window.getSelection().getRangeAt(0);

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" data-action="disable">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
                禁用选中的文字
            </div>
            <div class="context-menu-item" data-action="hide">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                隐藏选中的文字
            </div>
        `;

        this.positionAndShowMenu(menu, x, y);

        // 绑定菜单项事件
        menu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            if (action) {
                if (action === 'disable') {
                    this.disableSelectedTextFromMenu();
                } else if (action === 'hide') {
                    this.hideSelectedTextFromMenu();
                }
                this.hideContextMenu();
            }
        });
    }

    showDisabledTextMenu(x, y, disabledElement) {
        this.hideContextMenu();

        const fragmentId = disabledElement.dataset.fragmentId;
        const fragment = this.fragments.find(f => f.id == fragmentId);

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" data-action="edit-disabled">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                编辑禁用内容
            </div>
            <div class="context-menu-item" data-action="enable">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                启用此文字
            </div>
            <div class="context-menu-item" data-action="hide-disabled">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                隐藏此文字
            </div>
        `;

        this.positionAndShowMenu(menu, x, y);

        // 绑定菜单项事件
        menu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            if (action) {
                if (action === 'edit-disabled') {
                    this.editDisabledContent(fragmentId);
                } else if (action === 'enable') {
                    this.enableDisabledText(fragmentId);
                } else if (action === 'hide-disabled') {
                    this.hideDisabledText(fragmentId);
                }
                this.hideContextMenu();
            }
        });
    }

    positionAndShowMenu(menu, x, y) {
        menu.style.position = 'fixed';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.zIndex = '10000';

        // 确保菜单不会超出视口
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (x + rect.width > viewportWidth) {
            menu.style.left = (viewportWidth - rect.width) + 'px';
        }

        if (y + rect.height > viewportHeight) {
            menu.style.top = (viewportHeight - rect.height) + 'px';
        }

        document.body.appendChild(menu);
        this.contextMenu = menu;

        // 添加菜单类名用于样式区分
        if (menu.classList.contains('hidden-element-menu')) {
            menu.classList.add('hidden-element-context-menu');
        }
    }

    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
        // 清理待处理的选中文字和范围
        this.pendingSelectedText = null;
        this.pendingSelectionRange = null;
    }

    updateToolbarState() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        const hasSelection = selectedText.length > 0;

        this.toolbarBtns.disable.style.opacity = hasSelection ? '1' : '0.5';
        this.toolbarBtns.hide.style.opacity = hasSelection ? '1' : '0.5';
        this.toolbarBtns.enable.style.opacity = hasSelection ? '1' : '0.5';

        this.toolbarBtns.disable.disabled = !hasSelection;
        this.toolbarBtns.hide.disabled = !hasSelection;
        this.toolbarBtns.enable.disabled = !hasSelection;
    }

    disableSelectedText() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString().trim();
        if (!selectedText) return;

        const startOffset = this.getTextOffset(range.startContainer, range.startOffset);
        const currentText = this.textEditor.textContent;

        // 创建禁用片段，保存上下文信息
        const fragment = {
            id: this.nextFragmentId++,
            content: selectedText,
            type: 'disabled',
            startOffset: startOffset,
            endOffset: startOffset + selectedText.length,
            originalStartOffset: startOffset,
            contextBefore: startOffset > 0 ? currentText.substring(Math.max(0, startOffset - 10), startOffset) : '',
            contextAfter: (startOffset + selectedText.length) < currentText.length ?
                currentText.substring(startOffset + selectedText.length, startOffset + selectedText.length + 10) : ''
        };

        this.fragments.push(fragment);

        // 自动保存Agent设定
        this.autoSaveAgentSettings();

        this.renderText();
        selection.removeAllRanges();
    }

    disableSelectedTextFromMenu() {
        if (!this.pendingSelectedText || !this.pendingSelectionRange) return;

        const startOffset = this.getTextOffset(this.pendingSelectionRange.startContainer, this.pendingSelectionRange.startOffset);
        const currentText = this.textEditor.textContent;

        // 创建禁用片段，保存上下文信息
        const fragment = {
            id: this.nextFragmentId++,
            content: this.pendingSelectedText,
            type: 'disabled',
            startOffset: startOffset,
            endOffset: startOffset + this.pendingSelectedText.length,
            originalStartOffset: startOffset,
            contextBefore: startOffset > 0 ? currentText.substring(Math.max(0, startOffset - 10), startOffset) : '',
            contextAfter: (startOffset + this.pendingSelectedText.length) < currentText.length ?
                currentText.substring(startOffset + this.pendingSelectedText.length, startOffset + this.pendingSelectedText.length + 10) : ''
        };

        this.fragments.push(fragment);
        this.renderText();
        this.pendingSelectedText = null;
        this.pendingSelectionRange = null;
    }

    hideSelectedText() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString().trim();
        if (!selectedText) return;

        // 创建隐藏元素
        const hiddenElement = {
            id: this.nextHiddenId++,
            content: selectedText,
            displayName: `隐藏内容`,
            type: 'hidden',
            bubbleColor: '#3B82F6', // 默认气泡颜色
            textColor: '#FFFFFF'    // 默认文字颜色
        };

        console.log('[AdvancedPromptEditor] Created hidden element:', hiddenElement);

        this.hiddenElements.push(hiddenElement);

        // 从文本编辑器中移除选中的文字
        range.deleteContents();

        // 重新计算剩余片段的偏移量
        this.recalculateFragmentOffsets();

        // 自动保存Agent设定
        this.autoSaveAgentSettings();

        this.renderHiddenElements();
        selection.removeAllRanges();
    }

    hideSelectedTextFromMenu() {
        if (!this.pendingSelectedText || !this.pendingSelectionRange) return;

        // 创建隐藏元素
        const hiddenElement = {
            id: this.nextHiddenId++,
            content: this.pendingSelectedText,
            displayName: `隐藏内容`,
            type: 'hidden',
            bubbleColor: '#3B82F6', // 默认气泡颜色
            textColor: '#FFFFFF'    // 默认文字颜色
        };

        console.log('[AdvancedPromptEditor] Created hidden element from menu:', hiddenElement);

        this.hiddenElements.push(hiddenElement);

        // 使用保存的范围来删除选中的文字
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(this.pendingSelectionRange);
        selection.deleteFromDocument();

        this.renderHiddenElements();
        this.pendingSelectedText = null;
        this.pendingSelectionRange = null;
    }

    enableDisabledText(fragmentId) {
        // 从fragments中移除禁用的片段
        this.fragments = this.fragments.filter(f => f.id != fragmentId);

        // 重新计算剩余片段的偏移量
        this.recalculateFragmentOffsets();

        // 自动保存Agent设定
        this.autoSaveAgentSettings();

        this.renderText();
    }

    hideDisabledText(fragmentId) {
        // 将禁用的片段转换为隐藏元素
        const fragment = this.fragments.find(f => f.id == fragmentId);
        if (fragment) {
            // 创建隐藏元素
            const hiddenElement = {
                id: this.nextHiddenId++,
                content: fragment.content,
                displayName: `隐藏内容`,
                type: 'hidden',
                bubbleColor: '#3B82F6', // 默认气泡颜色
                textColor: '#FFFFFF'    // 默认文字颜色
            };

            console.log('[AdvancedPromptEditor] Created hidden element from disabled text:', hiddenElement);

            this.hiddenElements.push(hiddenElement);
            this.renderHiddenElements();

            // 从文本编辑器中移除这段文字
            const currentText = this.textEditor.textContent;
            const newText = currentText.replace(fragment.content, '');
            this.textEditor.textContent = newText;

            // 保存上下文信息到fragment（在删除前）
            if (!fragment.contextBefore) {
                fragment.contextBefore = currentText.substring(Math.max(0, fragment.startOffset - 10), fragment.startOffset);
            }
            if (!fragment.contextAfter) {
                fragment.contextAfter = currentText.substring(fragment.endOffset, Math.min(currentText.length, fragment.endOffset + 10));
            }

            // 从fragments中移除禁用的片段
            this.fragments = this.fragments.filter(f => f.id != fragmentId);

            // 重新计算剩余片段的偏移量
            this.recalculateFragmentOffsets();

            // 自动保存Agent设定
            this.autoSaveAgentSettings();

            this.renderText();
        }
    }

    handleTextInput() {
        // 处理文本输入，保护禁用内容不被修改
        this.protectDisabledContent();
        // 更新片段位置和上下文信息
        this.recalculateFragmentOffsets();
        this.updateFragments();

        // 确保所有fragment的originalStartOffset都得到更新
        this.fragments.forEach(fragment => {
            if (fragment.type === 'disabled' && fragment.startOffset !== undefined && fragment.startOffset >= 0) {
                fragment.originalStartOffset = fragment.startOffset;
            }
        });
    }

    protectDisabledContent() {
        const currentText = this.textEditor.textContent;
        const expectedText = this.buildExpectedText();

        if (currentText !== expectedText) {
            console.log('[AdvancedPromptEditor] Disabled content was modified, restoring...');
            this.textEditor.textContent = expectedText;

            // 更新所有fragment的上下文信息和原始位置
            this.fragments.forEach(fragment => {
                if (fragment.type === 'disabled') {
                    fragment.originalStartOffset = fragment.startOffset;
                    this.updateFragmentContext(fragment);
                }
            });

            // 强制重新渲染以确保显示正确
            this.renderText();
        }
    }

    buildExpectedText() {
        const currentText = this.textEditor.textContent;
        let result = '';
        let lastIndex = 0;

        // 按位置排序片段
        const sortedFragments = this.fragments
            .filter(f => f.startOffset !== undefined && f.endOffset !== undefined && f.type === 'disabled')
            .sort((a, b) => a.startOffset - b.startOffset);

        sortedFragments.forEach(fragment => {
            // 添加正常文本
            if (fragment.startOffset > lastIndex) {
                result += currentText.substring(lastIndex, fragment.startOffset);
            }

            // 添加禁用文本（如果内容仍然存在且位置正确）
            if (fragment.content && fragment.startOffset >= 0 && fragment.endOffset <= currentText.length) {
                const actualContent = currentText.substring(fragment.startOffset, fragment.endOffset);
                if (actualContent === fragment.content) {
                    result += fragment.content;
                } else {
                    // 如果内容不匹配，使用精确匹配算法重新定位
                    const correctOffset = this.findCorrectFragmentOffset(fragment, currentText);
                    if (correctOffset !== -1 && correctOffset >= lastIndex) {
                        // 调整位置
                        if (correctOffset > lastIndex) {
                            result += currentText.substring(lastIndex, correctOffset);
                        }
                        result += fragment.content;
                        fragment.startOffset = correctOffset;
                        fragment.endOffset = correctOffset + fragment.content.length;
                    } else {
                        // 如果找不到内容，跳过这个fragment
                        console.warn('[AdvancedPromptEditor] Could not find disabled content:', fragment.content);
                    }
                }
            }

            lastIndex = fragment.endOffset;
        });

        // 添加剩余的正常文本
        if (lastIndex < currentText.length) {
            result += currentText.substring(lastIndex);
        }

        return result;
    }

    insertTextAtCursor(text) {
        const selection = window.getSelection();

        if (selection.rangeCount > 0) {
            // 如果有选区，替换选区内容
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // 如果没有选区，在光标位置插入
            const range = document.createRange();
            range.selectNodeContents(this.textEditor);
            range.collapse(false); // 折叠到末尾
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        // 重新计算片段偏移量
        this.recalculateFragmentOffsets();

        // 确保所有fragment的originalStartOffset都得到更新
        this.fragments.forEach(fragment => {
            if (fragment.type === 'disabled' && fragment.startOffset !== undefined && fragment.startOffset >= 0) {
                fragment.originalStartOffset = fragment.startOffset;
            }
        });

        // 自动保存Agent设定
        this.autoSaveAgentSettings();

        this.updateFragments();
    }

    updateFragments() {
        // 更新片段在文本中的位置
        // 这个方法需要根据当前文本内容重新计算片段位置
    }

    recalculateFragmentOffsets() {
        // 重新计算所有片段的偏移量
        const currentText = this.textEditor.textContent;

        // 首先为所有fragments增强上下文信息，并更新originalStartOffset
        this.fragments = this.fragments.map(fragment => {
            const enhanced = this.enhanceFragmentContext(fragment);
            // 更新originalStartOffset为当前的位置，以便下次计算时使用
            if (enhanced.startOffset !== undefined && enhanced.startOffset >= 0) {
                enhanced.originalStartOffset = enhanced.startOffset;
            }
            return enhanced;
        });

        // 按位置排序片段
        this.fragments.forEach(fragment => {
            if (fragment.content && fragment.type === 'disabled') {
                // 使用精确匹配算法查找正确的位置
                const correctOffset = this.findCorrectFragmentOffset(fragment, currentText);
                if (correctOffset !== -1) {
                    fragment.startOffset = correctOffset;
                    fragment.endOffset = correctOffset + fragment.content.length;
                } else {
                    // 如果找不到内容，重置偏移量
                    fragment.startOffset = 0;
                    fragment.endOffset = 0;
                }
            }
        });

        console.log('[AdvancedPromptEditor] Recalculated fragment offsets:', this.fragments);
    }

    findCorrectFragmentOffset(fragment, text) {
        // 精确匹配算法，优先使用上下文信息进行定位
        const content = fragment.content;

        // 如果fragment有上下文信息，使用上下文进行精确定位
        if (fragment.contextBefore || fragment.contextAfter) {
            return this.findWithContext(fragment, text);
        }

        // 如果没有上下文信息，使用改进的位置匹配算法
        return this.findWithPositionMatching(fragment, text);
    }

    findWithContext(fragment, text) {
        const content = fragment.content;
        const contextBefore = fragment.contextBefore || '';
        const contextAfter = fragment.contextAfter || '';

        // 在文本中查找所有匹配的内容位置
        const matches = [];
        let searchIndex = 0;
        let contentIndex;

        while ((contentIndex = text.indexOf(content, searchIndex)) !== -1) {
            matches.push(contentIndex);
            searchIndex = contentIndex + 1;
        }

        // 如果只找到一个匹配，直接返回
        if (matches.length === 1) {
            return matches[0];
        }

        // 如果找到多个匹配，使用上下文信息进行筛选
        if (matches.length > 1) {
            for (const matchIndex of matches) {
                let isCorrectMatch = true;

                // 检查前文上下文
                if (contextBefore) {
                    const beforeStart = Math.max(0, matchIndex - contextBefore.length);
                    const beforeText = text.substring(beforeStart, matchIndex);
                    if (!beforeText.endsWith(contextBefore)) {
                        isCorrectMatch = false;
                    }
                }

                // 检查后文上下文
                if (contextAfter && isCorrectMatch) {
                    const afterEnd = Math.min(text.length, matchIndex + content.length + contextAfter.length);
                    const afterText = text.substring(matchIndex + content.length, afterEnd);
                    if (!afterText.startsWith(contextAfter)) {
                        isCorrectMatch = false;
                    }
                }

                if (isCorrectMatch) {
                    return matchIndex;
                }
            }
        }

        // 如果上下文匹配都失败，回退到位置匹配
        return this.findWithPositionMatching(fragment, text);
    }

    findWithPositionMatching(fragment, text) {
        const content = fragment.content;

        // 在文本中查找所有匹配的内容位置
        const matches = [];
        let searchIndex = 0;
        let contentIndex;

        while ((contentIndex = text.indexOf(content, searchIndex)) !== -1) {
            matches.push(contentIndex);
            searchIndex = contentIndex + 1;
        }

        // 如果只找到一个匹配，直接返回
        if (matches.length === 1) {
            return matches[0];
        }

        // 如果找到多个匹配，使用位置启发式算法
        if (matches.length > 1) {
            // 优先选择与原始位置最接近的匹配
            if (fragment.originalStartOffset !== undefined && fragment.originalStartOffset >= 0) {
                let closestMatch = matches[0];
                let minDistance = Math.abs(matches[0] - fragment.originalStartOffset);

                for (let i = 1; i < matches.length; i++) {
                    const distance = Math.abs(matches[i] - fragment.originalStartOffset);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestMatch = matches[i];
                    }
                }

                return closestMatch;
            }

            // 如果没有原始位置信息，选择第一个合理的匹配
            // 避免选择过于靠前或靠后的位置
            for (const matchIndex of matches) {
                const relativePosition = matchIndex / text.length;
                if (relativePosition > 0.1 && relativePosition < 0.9) {
                    return matchIndex;
                }
            }

            // 如果所有匹配都在边缘位置，返回第一个
            return matches[0];
        }

        return -1;
    }

    editDisabledContent(fragmentId) {
        const fragment = this.fragments.find(f => f.id == fragmentId);
        if (!fragment) return;

        // 创建编辑对话框
        const modal = document.createElement('div');
        modal.className = 'disabled-content-editor-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>编辑禁用内容</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>禁用内容:</label>
                        <textarea id="editDisabledContent" rows="4" placeholder="请输入要禁用的内容">${this.escapeHtml(fragment.content)}</textarea>
                    </div>
                    <div class="form-group">
                        <label>内容预览:</label>
                        <div id="contentPreview" class="content-preview">预览区域</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel">取消</button>
                    <button class="btn-save">保存修改</button>
                </div>
            </div>
        `;

        // 定位模态框
        modal.style.position = 'fixed';
        modal.style.left = '0';
        modal.style.top = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '10002';

        document.body.appendChild(modal);

        // 更新预览
        const previewDiv = modal.querySelector('#contentPreview');
        const textarea = modal.querySelector('#editDisabledContent');

        const updatePreview = () => {
            const content = textarea.value.trim();
            if (content) {
                previewDiv.innerHTML = `<span class="disabled-text-preview">${this.escapeHtml(content)}</span>`;
            } else {
                previewDiv.textContent = '请输入内容';
            }
        };

        textarea.addEventListener('input', updatePreview);
        updatePreview(); // 初始预览

        // 绑定事件
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const saveBtn = modal.querySelector('.btn-save');

        const closeModal = () => {
            modal.remove();
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        saveBtn.addEventListener('click', () => {
            const newContent = textarea.value.trim();

            if (newContent && newContent !== fragment.content) {
                // 更新fragment内容和相关参数
                const oldContent = fragment.content;
                const currentText = this.textEditor.textContent;

                // 更新文本内容
                const newText = currentText.replace(oldContent, newContent);
                this.textEditor.textContent = newText;

                // 更新fragment信息
                fragment.content = newContent;
                fragment.endOffset = fragment.startOffset + newContent.length;

                // 更新上下文信息和原始位置
                fragment.originalStartOffset = fragment.startOffset;
                this.updateFragmentContext(fragment);

                // 重新计算所有片段的偏移量以确保一致性
                this.recalculateFragmentOffsets();

                // 重新计算所有片段的偏移量
                this.recalculateFragmentOffsets();

                // 自动保存Agent设定
                this.autoSaveAgentSettings();

                // 重新渲染
                this.renderText();

                console.log(`[AdvancedPromptEditor] Disabled content edited: "${oldContent}" -> "${newContent}"`);
                closeModal();
            } else if (!newContent) {
                alert('禁用内容不能为空！');
            } else {
                closeModal();
            }
        });

        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    updateFragmentContext(fragment) {
        // 更新指定fragment的上下文信息
        if (fragment && fragment.startOffset !== undefined) {
            const currentText = this.textEditor.textContent;
            const startOffset = fragment.startOffset;

            fragment.contextBefore = startOffset > 0 ?
                currentText.substring(Math.max(0, startOffset - 10), startOffset) : '';
            fragment.contextAfter = (startOffset + fragment.content.length) < currentText.length ?
                currentText.substring(startOffset + fragment.content.length, startOffset + fragment.content.length + 10) : '';
            fragment.originalStartOffset = startOffset; // 更新原始位置

            console.log(`[AdvancedPromptEditor] Updated context for fragment:`, {
                content: fragment.content,
                startOffset: fragment.startOffset,
                contextBefore: fragment.contextBefore,
                contextAfter: fragment.contextAfter
            });
        }
    }

    handlePaste(e) {
        // 处理粘贴事件，防止粘贴到禁用内容上
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

            // 检查粘贴位置是否在禁用内容内
            const parentElement = range.commonAncestorContainer.parentElement;
            if (parentElement && parentElement.classList.contains('disabled-text')) {
                e.preventDefault();
                console.log('[AdvancedPromptEditor] Prevented paste in disabled content');
                return;
            }

            // 检查是否有禁用内容在选区内
            const selectedText = range.toString();
            if (selectedText) {
                const currentText = this.textEditor.textContent;
                const startOffset = this.getTextOffset(range.startContainer, range.startOffset);
                const endOffset = this.getTextOffset(range.endContainer, range.endOffset);

                // 检查选区内是否有禁用内容
                const sortedFragments = this.fragments
                    .filter(f => f.type === 'disabled')
                    .sort((a, b) => a.startOffset - b.startOffset);

                for (const fragment of sortedFragments) {
                    if (fragment.startOffset < endOffset && fragment.endOffset > startOffset) {
                        e.preventDefault();
                        console.log('[AdvancedPromptEditor] Prevented paste that would affect disabled content');
                        return;
                    }
                }
            }
        }
    }

    handleKeyDown(e) {
        // 处理键盘事件，防止删除或修改禁用内容
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

            // 检查是否有禁用内容在选区内或光标位置
            const currentText = this.textEditor.textContent;
            const startOffset = this.getTextOffset(range.startContainer, range.startOffset);
            const endOffset = range.collapsed ? startOffset : this.getTextOffset(range.endContainer, range.endOffset);

            // 检查光标位置或选区是否与禁用内容重叠
            const sortedFragments = this.fragments
                .filter(f => f.type === 'disabled')
                .sort((a, b) => a.startOffset - b.startOffset);

            for (const fragment of sortedFragments) {
                if (fragment.startOffset < endOffset && fragment.endOffset > startOffset) {
                    // 如果是删除键，阻止操作
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                        e.preventDefault();
                        console.log('[AdvancedPromptEditor] Prevented deletion of disabled content');
                        return;
                    }

                    // 如果是输入字符，阻止操作（但允许方向键等导航键）
                    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                        e.preventDefault();
                        console.log('[AdvancedPromptEditor] Prevented typing in disabled content');
                        return;
                    }
                }
            }
        }
    }

    handleBeforeInput(e) {
        // 在输入前检查是否会影响禁用内容
        if (e.inputType === 'insertText' || e.inputType === 'insertReplacementText') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);

                // 检查输入位置是否在禁用内容内
                const parentElement = range.commonAncestorContainer.parentElement;
                if (parentElement && parentElement.classList.contains('disabled-text')) {
                    e.preventDefault();
                    console.log('[AdvancedPromptEditor] Prevented input in disabled content');
                    return;
                }

                // 检查是否有禁用内容在受影响的范围内
                const currentText = this.textEditor.textContent;
                const startOffset = this.getTextOffset(range.startContainer, range.startOffset);
                const endOffset = range.collapsed ? startOffset : this.getTextOffset(range.endContainer, range.endOffset);

                const sortedFragments = this.fragments
                    .filter(f => f.type === 'disabled')
                    .sort((a, b) => a.startOffset - b.startOffset);

                for (const fragment of sortedFragments) {
                    if (fragment.startOffset < endOffset && fragment.endOffset > startOffset) {
                        e.preventDefault();
                        console.log('[AdvancedPromptEditor] Prevented input that would affect disabled content');
                        return;
                    }
                }
            }
        }
    }

    autoSaveAgentSettings() {
        // 自动保存Agent设定
        if (window.settingsManager && typeof window.settingsManager.triggerAutoSave === 'function') {
            console.log('[AdvancedPromptEditor] Auto-saving agent settings');
            window.settingsManager.triggerAutoSave();
        } else {
            console.log('[AdvancedPromptEditor] Auto-save not available - settingsManager not ready');
        }
    }

    renderText() {
        const currentText = this.textEditor.textContent;
        let html = '';
        let lastIndex = 0;

        // 按位置排序片段
        const sortedFragments = this.fragments
            .filter(f => f.startOffset !== undefined && f.endOffset !== undefined)
            .sort((a, b) => a.startOffset - b.startOffset);

        sortedFragments.forEach(fragment => {
            // 添加正常文本
            if (fragment.startOffset > lastIndex) {
                const normalText = currentText.substring(lastIndex, fragment.startOffset);
                html += this.escapeHtml(normalText);
            }

            // 添加禁用文本
            if (fragment.type === 'disabled') {
                const disabledText = currentText.substring(fragment.startOffset, fragment.endOffset);
                html += `<span class="disabled-text" data-fragment-id="${fragment.id}" contenteditable="false" style="user-select: text;">${this.escapeHtml(disabledText)}</span>`;
            }

            lastIndex = fragment.endOffset;
        });

        // 添加剩余的正常文本
        if (lastIndex < currentText.length) {
            const remainingText = currentText.substring(lastIndex);
            html += this.escapeHtml(remainingText);
        }

        this.textEditor.innerHTML = html;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getTextOffset(container, offset) {
        if (!container) return 0;

        const root = this.textEditor;
        const treeWalker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let currentOffset = 0;
        let node = treeWalker.nextNode();

        while (node) {
            if (node === container) {
                return currentOffset + offset;
            }
            currentOffset += node.textContent.length;
            node = treeWalker.nextNode();
        }

        return currentOffset;
    }

    renderHiddenElements() {
        this.hiddenElementsContainer.innerHTML = '';

        if (this.hiddenElements.length === 0) {
            this.hiddenElementsContainer.innerHTML = '<span class="no-hidden-elements">暂无隐藏元素</span>';
            return;
        }

        this.hiddenElements.forEach(element => {
            const dot = document.createElement('div');
            dot.className = 'hidden-element-dot';
            dot.draggable = true;
            dot.dataset.elementId = element.id;
            dot.title = element.displayName + ': ' + element.content;

            // 使用自定义颜色，确保有默认值
            const bubbleColor = element.bubbleColor || '#3B82F6';
            const textColor = element.textColor || '#FFFFFF';

            // 确保元素的颜色属性被保存
            element.bubbleColor = bubbleColor;
            element.textColor = textColor;

            dot.style.backgroundColor = bubbleColor;
            dot.style.color = textColor;
            dot.style.borderColor = bubbleColor;

            dot.innerHTML = `
                <span class="dot-label">${this.escapeHtml(element.displayName)}</span>
            `;

            // 绑定拖拽事件
            dot.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', element.content);
                e.dataTransfer.effectAllowed = 'copy';
                dot.classList.add('dragging');
            });

            dot.addEventListener('dragend', () => {
                dot.classList.remove('dragging');
            });

            // 绑定右键菜单事件
            dot.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showHiddenElementContextMenu(e.clientX, e.clientY, element);
            });

            // 点击小圆点显示内容预览
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showHiddenElementPreview(element);
            });

            this.hiddenElementsContainer.appendChild(dot);
        });
    }

    handleHiddenElementDrop(e) {
        e.preventDefault();
        const content = e.dataTransfer.getData('text/plain');
        if (content) {
            // 直接插入内容
            this.insertTextAtCursor(content);
        }
    }

    insertHiddenContent(element) {
        const selection = window.getSelection();

        if (selection.rangeCount > 0) {
            // 如果有选区，替换选区内容
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode(element.content);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // 如果没有选区，在光标位置插入
            const range = document.createRange();
            range.selectNodeContents(this.textEditor);
            range.collapse(false); // 折叠到末尾
            const textNode = document.createTextNode(element.content);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        // 重新计算片段偏移量
        this.recalculateFragmentOffsets();

        // 确保所有fragment的originalStartOffset都得到更新
        this.fragments.forEach(fragment => {
            if (fragment.type === 'disabled' && fragment.startOffset !== undefined && fragment.startOffset >= 0) {
                fragment.originalStartOffset = fragment.startOffset;
            }
        });

        // 自动保存Agent设定
        this.autoSaveAgentSettings();

        this.updateFragments();
    }

    renameHiddenElement(elementId) {
        const element = this.hiddenElements.find(el => el.id == elementId);
        if (element) {
            this.showHiddenElementEditor(element);
        }
    }

    showHiddenElementEditor(element) {
        // 创建编辑对话框
        const modal = document.createElement('div');
        modal.className = 'hidden-element-editor-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>编辑隐藏元素</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>显示名称:</label>
                        <input type="text" id="editDisplayName" value="${this.escapeHtml(element.displayName)}">
                    </div>
                    <div class="form-group">
                        <label>隐藏内容:</label>
                        <textarea id="editContent" rows="4">${this.escapeHtml(element.content)}</textarea>
                    </div>
                    <div class="form-group">
                        <label>气泡颜色:</label>
                        <input type="color" id="editBubbleColor" value="${element.bubbleColor || '#3B82F6'}">
                    </div>
                    <div class="form-group">
                        <label>文字颜色:</label>
                        <input type="color" id="editTextColor" value="${element.textColor || '#FFFFFF'}">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel">取消</button>
                    <button class="btn-save">保存</button>
                </div>
            </div>
        `;

        // 定位模态框
        modal.style.position = 'fixed';
        modal.style.left = '0';
        modal.style.top = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '10002';

        document.body.appendChild(modal);

        // 绑定事件
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const saveBtn = modal.querySelector('.btn-save');

        const closeModal = () => {
            modal.remove();
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        saveBtn.addEventListener('click', () => {
            const newDisplayName = modal.querySelector('#editDisplayName').value.trim();
            const newContent = modal.querySelector('#editContent').value.trim();
            const newBubbleColor = modal.querySelector('#editBubbleColor').value;
            const newTextColor = modal.querySelector('#editTextColor').value;

            if (newDisplayName && newContent) {
                element.displayName = newDisplayName;
                element.content = newContent;
                element.bubbleColor = newBubbleColor;
                element.textColor = newTextColor;

                // 如果内容发生变化，需要重新计算片段偏移量
                if (newContent !== element.content) {
                    this.recalculateFragmentOffsets();
                }

                // 自动保存Agent设定
                this.autoSaveAgentSettings();

                this.renderHiddenElements();
                closeModal();
            } else {
                alert('显示名称和隐藏内容不能为空！');
            }
        });

        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    deleteHiddenElement(elementId) {
        if (confirm('确定要删除这个隐藏元素吗？')) {
            // 只删除指定的隐藏元素，不影响其他元素
            this.hiddenElements = this.hiddenElements.filter(el => el.id != elementId);

            // 重新计算剩余片段的偏移量（因为删除了隐藏元素后文本长度可能变化）
            this.recalculateFragmentOffsets();

            // 自动保存Agent设定
            this.autoSaveAgentSettings();

            this.renderHiddenElements();
        }
    }

    showHiddenElementContextMenu(x, y, element) {
        this.hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu hidden-element-menu';
        menu.innerHTML = `
            <div class="context-menu-item" data-action="edit" data-element-id="${element.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                编辑
            </div>
            <div class="context-menu-item" data-action="delete" data-element-id="${element.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                删除
            </div>
        `;

        this.positionAndShowMenu(menu, x, y);

        // 绑定菜单项事件
        menu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            const elementId = e.target.closest('.context-menu-item')?.dataset.elementId;
            if (action && elementId) {
                if (action === 'edit') {
                    this.showHiddenElementEditor(this.hiddenElements.find(el => el.id == elementId));
                } else if (action === 'delete') {
                    this.deleteHiddenElement(elementId);
                }
                this.hideContextMenu();
            }
        });
    }

    showHiddenElementPreview(element) {
        // 显示隐藏元素内容的预览
        const preview = document.createElement('div');
        preview.className = 'hidden-element-preview';
        preview.innerHTML = `
            <div class="preview-header">
                <strong>${this.escapeHtml(element.displayName)}</strong>
                <button class="preview-close">&times;</button>
            </div>
            <div class="preview-content">${this.escapeHtml(element.content)}</div>
        `;

        // 定位预览框
        const rect = this.container.getBoundingClientRect();
        preview.style.position = 'absolute';
        preview.style.left = '10px';
        preview.style.top = '10px';
        preview.style.zIndex = '10001';

        this.container.appendChild(preview);

        // 绑定关闭事件
        const closeBtn = preview.querySelector('.preview-close');
        closeBtn.addEventListener('click', () => {
            preview.remove();
        });

        // 点击外部关闭
        setTimeout(() => {
            const clickHandler = (e) => {
                if (!preview.contains(e.target)) {
                    preview.remove();
                    document.removeEventListener('click', clickHandler);
                }
            };
            document.addEventListener('click', clickHandler);
        }, 100);
    }

    getValue() {
        // 返回最终的提示词内容（排除禁用和隐藏的内容）
        // 由于隐藏内容已经被从界面中移除了，这里只需要处理禁用内容
        let result = '';

        // 获取当前文本内容
        const currentText = this.textEditor.textContent;

        // 过滤掉禁用的内容
        let lastIndex = 0;
        const sortedFragments = this.fragments
            .filter(f => f.startOffset !== undefined && f.endOffset !== undefined && f.type === 'disabled')
            .sort((a, b) => a.startOffset - b.startOffset);

        sortedFragments.forEach(fragment => {
            // 添加正常文本（排除禁用部分）
            if (fragment.startOffset > lastIndex) {
                const normalText = currentText.substring(lastIndex, fragment.startOffset);
                result += normalText;
            }

            // 跳过禁用的内容
            if (fragment.endOffset > fragment.startOffset) {
                lastIndex = fragment.endOffset;
            }
        });

        // 添加剩余的正常文本
        if (lastIndex < currentText.length) {
            const remainingText = currentText.substring(lastIndex);
            result += remainingText;
        }

        return result.trim();
    }

    setValue(value) {
        // 设置编辑器的值，清空现有状态
        this.fragments = [];
        this.hiddenElements = [];
        this.pendingSelectedText = null;
        this.pendingSelectionRange = null;
        this.textEditor.innerHTML = value || '';

        // 重新计算片段偏移量（虽然fragments已被清空，但保持一致性）
        this.recalculateFragmentOffsets();

        this.renderHiddenElements();
        this.updateToolbarState();
        this.updateHiddenElementColors();
    }

    // 新增方法：为现有fragment添加上下文信息
    enhanceFragmentContext(fragment) {
        if (fragment.content && fragment.startOffset !== undefined && fragment.startOffset >= 0) {
            const currentText = this.textEditor.textContent;
            const startOffset = fragment.startOffset;

            // 只有在上下文信息缺失或位置发生变化时才更新
            const needsContextUpdate = !fragment.contextBefore ||
                !fragment.contextAfter ||
                fragment.originalStartOffset !== startOffset;

            if (needsContextUpdate) {
                return {
                    ...fragment,
                    originalStartOffset: fragment.originalStartOffset || startOffset,
                    contextBefore: fragment.contextBefore ||
                        (startOffset > 0 ? currentText.substring(Math.max(0, startOffset - 10), startOffset) : ''),
                    contextAfter: fragment.contextAfter ||
                        ((startOffset + fragment.content.length) < currentText.length ?
                            currentText.substring(startOffset + fragment.content.length, startOffset + fragment.content.length + 10) : '')
                };
            }
        }
        return fragment;
    }

    // 新增方法：为现有fragment添加上下文信息
    enhanceFragmentContext(fragment) {
        if (fragment.content && fragment.startOffset !== undefined && (!fragment.contextBefore || !fragment.contextAfter)) {
            const currentText = this.textEditor.textContent;
            const startOffset = fragment.startOffset;

            return {
                ...fragment,
                originalStartOffset: fragment.originalStartOffset || fragment.startOffset,
                contextBefore: fragment.contextBefore ||
                    (startOffset > 0 ? currentText.substring(Math.max(0, startOffset - 10), startOffset) : ''),
                contextAfter: fragment.contextAfter ||
                    ((startOffset + fragment.content.length) < currentText.length ?
                        currentText.substring(startOffset + fragment.content.length, startOffset + fragment.content.length + 10) : '')
            };
        }
        return fragment;
    }

    // 添加一个方法来更新现有隐藏元素的颜色（向后兼容）
    updateHiddenElementColors() {
        this.ensureHiddenElementColors();
        this.renderHiddenElements();
    }


    getFullValue() {
        // 返回完整内容，包含禁用和隐藏元素的元数据
        const result = {
            text: this.textEditor.textContent,
            fragments: this.fragments,
            hiddenElements: this.hiddenElements
        };

        console.log('[AdvancedPromptEditor] getFullValue:', {
            textLength: result.text.length,
            fragmentsCount: result.fragments.length,
            hiddenElementsCount: result.hiddenElements.length
        });

        return result;
    }

    setFullValue(data) {
        // 从完整数据恢复编辑器状态
        console.log('[AdvancedPromptEditor] setFullValue:', {
            hasText: !!data.text,
            hasFragments: !!data.fragments,
            hasHiddenElements: !!data.hiddenElements,
            textLength: data.text?.length || 0,
            fragmentsCount: data.fragments?.length || 0,
            hiddenElementsCount: data.hiddenElements?.length || 0
        });

        if (data.text) {
            this.textEditor.innerHTML = data.text;
        }
        if (data.fragments) {
            // 确保所有fragments都有上下文信息和正确的originalStartOffset
            this.fragments = data.fragments.map(fragment => {
                const enhanced = this.enhanceFragmentContext(fragment);
                // 确保originalStartOffset正确设置
                if (enhanced.startOffset !== undefined && enhanced.startOffset >= 0) {
                    if (enhanced.originalStartOffset === undefined) {
                        enhanced.originalStartOffset = enhanced.startOffset;
                    }
                }
                return enhanced;
            });
        }
        if (data.hiddenElements) {
            // 确保隐藏元素有颜色属性
            this.hiddenElements = data.hiddenElements.map(element => ({
                ...element,
                bubbleColor: element.bubbleColor || '#3B82F6',
                textColor: element.textColor || '#FFFFFF'
            }));
        } else {
            // 如果没有隐藏元素，初始化为空数组
            this.hiddenElements = [];
        }

        // 渲染隐藏元素，确保颜色被正确应用
        this.renderHiddenElements();

        // 确保所有隐藏元素都有正确的颜色属性
        this.updateHiddenElementColors();
        this.renderHiddenElements();

        // 重新计算片段偏移量
        this.recalculateFragmentOffsets();

        this.renderText();
        this.updateToolbarState();
    }
}

// 导出类
window.AdvancedPromptEditor = AdvancedPromptEditor;