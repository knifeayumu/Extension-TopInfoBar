const {
    eventSource,
    event_types,
    getCurrentChatId,
    callGenericPopup,
    renameChat,
    getRequestHeaders,
    openGroupChat,
    openCharacterChat,
    executeSlashCommands,
} = SillyTavern.getContext();
import { addJQueryHighlight } from './jquery-highlight.js';
import { debounce } from '../../../utils.js';

const movingDivs = document.getElementById('movingDivs');
const sheld = document.getElementById('sheld');
const chat = document.getElementById('chat');
const topBar = document.createElement('div');
const chatName = document.createElement('select');
const searchInput = document.createElement('input');
const draggableTemplate = document.getElementById('generic_draggable_template');

const icons = [
    {
        id: 'extensionTopBarToggleSidebar',
        icon: 'fa-fw fa-solid fa-box-archive',
        position: 'left',
        title: 'Toggle sidebar',
        onClick: onToggleSidebarClick,
    },
    {
        id: 'extensionTopBarChatManager',
        icon: 'fa-fw fa-solid fa-address-book',
        position: 'left',
        title: 'View chat files',
        onClick: onChatManagerClick,
    },
    {
        id: 'extensionTopBarNewChat',
        icon: 'fa-fw fa-solid fa-comments',
        position: 'right',
        title: 'New chat',
        onClick: onNewChatClick,
    },
    {
        id: 'extensionTopBarRenameChat',
        icon: 'fa-fw fa-solid fa-edit',
        position: 'right',
        title: 'Rename chat',
        onClick: onRenameChatClick,
    },
    {
        id: 'extensionTopBarDeleteChat',
        icon: 'fa-fw fa-solid fa-trash',
        position: 'right',
        title: 'Delete chat',
        onClick: async () => {
            const confirm = await callGenericPopup('<h3>Are you sure?</h3>', 2);
            if (confirm) {
                await executeSlashCommands('/delchat');
            }
        },
    },
    {
        id: 'extensionTopBarCloseChat',
        icon: 'fa-fw fa-solid fa-times',
        position: 'right',
        title: 'Close chat',
        onClick: onCloseChatClick,
    },
];

function onChatManagerClick() {
    document.getElementById('option_select_chat')?.click();
}

function onCloseChatClick() {
    document.getElementById('option_close_chat')?.click();
}

function onNewChatClick() {
    document.getElementById('option_start_new_chat')?.click();
}

async function onRenameChatClick() {
    const currentChatName = getCurrentChatId();

    if (!currentChatName) {
        return;
    }

    const newChatName = await callGenericPopup('Enter new chat name', 3, currentChatName);

    if (!newChatName || newChatName === currentChatName) {
        return;
    }

    await renameChat(currentChatName, newChatName);
}

function patchSheldIfNeeded() {
    // Fun fact: sheld is a typo. It should be shell.
    // It was fixed in OG TAI long ago, but we still have it here.
    if (!sheld) {
        console.error('Sheld not found. Did you finally rename it?');
        return;
    }

    const computedStyle = getComputedStyle(sheld);
    // Alert: We're not in a version that switched sheld to flex yet.
    if (computedStyle.display === 'grid') {
        sheld.classList.add('flexPatch');
    }
}

function setChatName(name) {
    const isNotInChat = !name;
    chatName.innerHTML = '';
    const selectedOption = document.createElement('option');
    selectedOption.innerText = name || 'No chat selected';
    selectedOption.selected = true;
    chatName.appendChild(selectedOption);
    chatName.disabled = true;

    icons.forEach(icon => {
        const iconElement = document.getElementById(icon.id);
        if (iconElement) {
            iconElement.classList.toggle('not-in-chat', isNotInChat);
        }
    });

    if (!isNotInChat && typeof openGroupChat === 'function' && typeof openCharacterChat === 'function') {
        setTimeout(async () => {
            const list = [];
            const context = SillyTavern.getContext();
            if (context.groupId) {
                const group = context.groups.find(x => x.id == context.groupId);
                if (group) {
                    list.push(...group.chats);
                }
            }
            else {
                const characterAvatar = context.characters[context.characterId]?.avatar;
                list.push(...await getListOfCharacterChats(characterAvatar));
            }

            if (list.length > 0) {
                chatName.innerHTML = '';
                list.sort((a, b) => a.localeCompare(b)).forEach((x) => {
                    const option = document.createElement('option');
                    option.innerText = x;
                    option.value = x;
                    option.selected = x === name;

                    chatName.appendChild(option);
                });
                chatName.disabled = false;
            }
        }, 0);
    }
}

async function getListOfCharacterChats(avatar) {
    try {
        const result = await fetch('/api/characters/chats', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ avatar_url: avatar, simple: true }),
        });

        if (!result.ok) {
            return [];
        }

        const data = await result.json();
        return data.map(x => String(x.file_name).replace('.jsonl', ''));
    } catch (error) {
        console.error('Failed to get list of character chats', error);
        return [];
    }
}

/**
 * Highlight search query in chat messages
 * @param {string} query Search query
 * @returns {void}
 */
function searchInChat(query) {
    const options = { element: 'mark', className: 'highlight' };
    const messages = jQuery(chat).find('.mes_text');
    messages.unhighlight(options);
    if (!query) {
        return;
    }
    const splitQuery = query.split(/\s|\b/);
    messages.highlight(splitQuery, options);
}

const searchDebounced = debounce((x) => searchInChat(x), 500);

function addTopBar() {
    chatName.id = 'extensionTopBarChatName';
    topBar.id = 'extensionTopBar';
    searchInput.id = 'extensionTopBarSearchInput';
    searchInput.placeholder = 'Search...';
    searchInput.classList.add('text_pole');
    searchInput.type = 'search';
    searchInput.addEventListener('input', () => searchDebounced(searchInput.value.trim()));
    topBar.appendChild(chatName);
    topBar.appendChild(searchInput);
    sheld.insertBefore(topBar, chat);
}

function addIcons() {
    icons.forEach(icon => {
        const iconElement = document.createElement('i');
        iconElement.id = icon.id;
        iconElement.className = icon.icon;
        iconElement.title = icon.title;
        iconElement.tabIndex = 0;
        iconElement.classList.add('right_menu_button');
        iconElement.addEventListener('click', () => {
            if (iconElement.classList.contains('not-in-chat')) {
                return;
            }
            icon.onClick();
        });
        if (icon.position === 'left') {
            topBar.insertBefore(iconElement, chatName);
            return;
        }
        if (icon.position === 'right') {
            topBar.appendChild(iconElement);
            return;
        }
        if (icon.position === 'middle') {
            topBar.insertBefore(iconElement, searchInput);
            return;
        }
        if (id === 'extensionTopBarRenameChat' && typeof renameChat !== 'function') {
            iconElement.classList.add('displayNone');
        }
    });
}

function addSideBar() {
    if (!draggableTemplate) {
        console.warn('Draggable template not found. Side bar will not be added.');
    }

    /** @type {DocumentFragment} */
    const fragment = draggableTemplate.content.cloneNode(true);
    const draggable = fragment.querySelector('.draggable');
    const closeButton = fragment.querySelector('.dragClose');
    draggable.id = 'extensionSideBar';
    closeButton.addEventListener('click', onToggleSidebarClick);

    const scrollContainer = document.createElement('div');
    scrollContainer.classList.add('scrollY');
    scrollContainer.id = 'extensionSideBarContainer';
    draggable.appendChild(scrollContainer);

    movingDivs.appendChild(draggable);
}

function onToggleSidebarClick() {
    document.getElementById('extensionSideBar')?.classList.toggle('visible');
    document.getElementById('extensionTopBarToggleSidebar')?.classList.toggle('active');
}

async function onChatNameChange() {
    const context = SillyTavern.getContext();
    const chatId = chatName.value;

    if (!chatId) {
        return;
    }

    if (typeof openGroupChat === 'function' && context.groupId) {
        await openGroupChat(context.groupId, chatId);
        return;
    }

    if (typeof openCharacterChat === 'function' && context.characterId !== undefined) {
        await openCharacterChat(chatId);
        return;
    }
}

// Init extension on load
(async function () {
    addJQueryHighlight();
    patchSheldIfNeeded();
    addTopBar();
    addIcons();
    addSideBar();
    setChatName(getCurrentChatId());
    chatName.addEventListener('change', onChatNameChange);
    eventSource.on(event_types.CHAT_CHANGED, setChatName);
})();
