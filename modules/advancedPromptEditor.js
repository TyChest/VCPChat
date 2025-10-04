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

        // 工具栏按钮事件
        this.toolbarBtns.disable.addEventListener('click', () => this.disableSelectedText());
        this.toolbarBtns.hide.addEventListener('click', () => this.hideSelectedText());
        this.toolbarBtns.enable.addEventListener('click', () => this.enableSelectedText());

        // 隐藏元素容器拖拽事件
        this.hiddenElementsContainer.addEventListener('dragover', (e) => e.preventDefault());
        this.hiddenElementsContainer.addEventListener('drop', (e) => this.handleHiddenElementDrop(e));

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
                if (action === 'enable') {
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

        // 创建禁用片段
        const fragment = {
            id: this.nextFragmentId++,
            content: selectedText,
            type: 'disabled',
            startOffset: this.getTextOffset(range.startContainer, range.startOffset),
            endOffset: this.getTextOffset(range.endContainer, range.endOffset)
        };

        this.fragments.push(fragment);
        this.renderText();
        selection.removeAllRanges();
    }

    disableSelectedTextFromMenu() {
        if (!this.pendingSelectedText || !this.pendingSelectionRange) return;

        // 创建禁用片段
        const fragment = {
            id: this.nextFragmentId++,
            content: this.pendingSelectedText,
            type: 'disabled',
            startOffset: this.getTextOffset(this.pendingSelectionRange.startContainer, this.pendingSelectionRange.startOffset),
            endOffset: this.getTextOffset(this.pendingSelectionRange.endContainer, this.pendingSelectionRange.endOffset)
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
            displayName: `隐藏内容 ${this.nextHiddenId - 1}`,
            type: 'hidden'
        };

        this.hiddenElements.push(hiddenElement);

        // 从文本编辑器中移除选中的文字
        range.deleteContents();

        this.renderHiddenElements();
        selection.removeAllRanges();
    }

    hideSelectedTextFromMenu() {
        if (!this.pendingSelectedText || !this.pendingSelectionRange) return;

        // 创建隐藏元素
        const hiddenElement = {
            id: this.nextHiddenId++,
            content: this.pendingSelectedText,
            displayName: `隐藏内容 ${this.nextHiddenId - 1}`,
            type: 'hidden'
        };

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
                displayName: `隐藏内容 ${this.nextHiddenId - 1}`,
                type: 'hidden'
            };

            this.hiddenElements.push(hiddenElement);
            this.renderHiddenElements();

            // 从fragments中移除禁用的片段
            this.fragments = this.fragments.filter(f => f.id != fragmentId);

            // 从文本编辑器中移除这段文字
            const currentText = this.textEditor.textContent;
            const newText = currentText.replace(fragment.content, '');
            this.textEditor.textContent = newText;

            this.renderText();
        }
    }

    handleTextInput() {
        // 处理文本输入，更新片段位置
        this.updateFragments();
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

        this.updateFragments();
    }

    updateFragments() {
        // 更新片段在文本中的位置
        // 这个方法需要根据当前文本内容重新计算片段位置
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
                html += `<span class="disabled-text" data-fragment-id="${fragment.id}">${this.escapeHtml(disabledText)}</span>`;
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

            dot.innerHTML = `
                <span class="dot-label">${this.escapeHtml(element.displayName)}</span>
                <div class="dot-actions">
                    <button class="dot-rename-btn" title="重命名">✏️</button>
                    <button class="dot-delete-btn" title="删除">🗑️</button>
                </div>
            `;

            // 绑定拖拽事件
            dot.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', element.content); // 传递内容而不是ID
                e.dataTransfer.effectAllowed = 'copy';
                dot.classList.add('dragging');
            });

            dot.addEventListener('dragend', () => {
                dot.classList.remove('dragging');
            });

            // 绑定重命名和删除事件
            const renameBtn = dot.querySelector('.dot-rename-btn');
            const deleteBtn = dot.querySelector('.dot-delete-btn');

            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.renameHiddenElement(element.id);
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteHiddenElement(element.id);
            });

            // 点击小圆点显示内容预览
            dot.addEventListener('click', (e) => {
                if (!e.target.classList.contains('dot-rename-btn') &&
                    !e.target.classList.contains('dot-delete-btn')) {
                    this.showHiddenElementPreview(element);
                }
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

        this.updateFragments();
    }

    renameHiddenElement(elementId) {
        const element = this.hiddenElements.find(el => el.id == elementId);
        if (element) {
            const newName = prompt('请输入新的显示名称:', element.displayName);
            if (newName && newName.trim()) {
                element.displayName = newName.trim();
                this.renderHiddenElements();
            }
        }
    }

    deleteHiddenElement(elementId) {
        if (confirm('确定要删除这个隐藏元素吗？')) {
            this.hiddenElements = this.hiddenElements.filter(el => el.id != elementId);
            this.renderHiddenElements();
        }
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
        this.renderHiddenElements();
        this.updateToolbarState();
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
            this.fragments = data.fragments;
        }
        if (data.hiddenElements) {
            this.hiddenElements = data.hiddenElements;
        }
        this.renderHiddenElements();
        this.renderText();
        this.updateToolbarState();
    }
}

// 导出类
window.AdvancedPromptEditor = AdvancedPromptEditor;