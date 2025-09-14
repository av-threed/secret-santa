// ui.js

export function showToast(message, type = 'success', durationMs = 2000) {
	const existing = document.querySelector('.notification');
	if (existing) existing.remove();
	const note = document.createElement('div');
	note.className = `notification ${type === 'error' ? 'error' : 'success'}`;
	note.textContent = message;
	document.body.appendChild(note);
	setTimeout(() => {
		note.classList.add('fade-out');
		note.addEventListener('animationend', () => note.remove(), { once: true });
	}, durationMs);
}

export function confirmDialog({ title = 'Confirm', message = 'Are you sure?', confirmText = 'Delete', cancelText = 'Cancel' } = {}) {
	return new Promise((resolve) => {
		const overlay = document.createElement('div');
		overlay.className = 'modal active';
		overlay.style.display = 'flex';

		const content = document.createElement('div');
		content.className = 'modal-content';

		const header = document.createElement('div');
		header.className = 'modal-header';
		const h2 = document.createElement('h2');
		h2.textContent = title;
		const closeBtn = document.createElement('button');
		closeBtn.className = 'modal-close';
		closeBtn.textContent = '×';
		header.appendChild(h2);
		header.appendChild(closeBtn);

		const body = document.createElement('div');
		body.className = 'modal-body';
		const p = document.createElement('p');
		p.textContent = message;
		body.appendChild(p);

		const actions = document.createElement('div');
		actions.style.display = 'flex';
		actions.style.gap = '10px';
		actions.style.marginTop = '10px';
		const cancel = document.createElement('button');
		cancel.textContent = cancelText;
		cancel.style.backgroundColor = '#6b7280';
		const confirm = document.createElement('button');
		confirm.textContent = confirmText;
		confirm.style.backgroundColor = 'var(--status-error)';
		actions.appendChild(cancel);
		actions.appendChild(confirm);
		body.appendChild(actions);

		content.appendChild(header);
		content.appendChild(body);
		overlay.appendChild(content);
		document.body.appendChild(overlay);

		function cleanup(result) {
			overlay.classList.remove('active');
			setTimeout(() => {
				if (!overlay.classList.contains('active')) overlay.remove();
			}, 200);
			resolve(result);
		}

		closeBtn.addEventListener('click', () => cleanup(false));
		cancel.addEventListener('click', () => cleanup(false));
		confirm.addEventListener('click', () => cleanup(true));
		overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
		document.addEventListener('keydown', function onKey(e) {
			if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', onKey); }
		});
	});
}

export function inputDialog({ title = 'Add', label = 'Enter value', placeholder = '', confirmText = 'Add', cancelText = 'Cancel' } = {}) {
	return new Promise((resolve) => {
		const overlay = document.createElement('div');
		overlay.className = 'modal active';
		overlay.style.display = 'flex';

		const content = document.createElement('div');
		content.className = 'modal-content';

		const header = document.createElement('div');
		header.className = 'modal-header';
		const h2 = document.createElement('h2');
		h2.textContent = title;
		const closeBtn = document.createElement('button');
		closeBtn.className = 'modal-close';
		closeBtn.textContent = '×';
		header.appendChild(h2);
		header.appendChild(closeBtn);

		const body = document.createElement('div');
		body.className = 'modal-body';
		const lab = document.createElement('label');
		lab.textContent = label;
		const input = document.createElement('input');
		input.type = 'text';
		input.placeholder = placeholder;
		input.style.width = '100%';
		input.style.padding = '10px';
		input.style.border = '1px solid var(--color-border)';
		input.style.borderRadius = '6px';
		input.autofocus = true;
		const actions = document.createElement('div');
		actions.style.display = 'flex';
		actions.style.gap = '10px';
		actions.style.marginTop = '10px';
		const cancel = document.createElement('button');
		cancel.textContent = cancelText;
		cancel.style.backgroundColor = '#6b7280';
		const confirm = document.createElement('button');
		confirm.textContent = confirmText;
		actions.appendChild(cancel);
		actions.appendChild(confirm);
		body.appendChild(lab);
		body.appendChild(input);
		body.appendChild(actions);

		content.appendChild(header);
		content.appendChild(body);
		overlay.appendChild(content);
		document.body.appendChild(overlay);

		function cleanup(value) {
			overlay.classList.remove('active');
			setTimeout(() => { if (!overlay.classList.contains('active')) overlay.remove(); }, 200);
			resolve(value);
		}

		closeBtn.addEventListener('click', () => cleanup(null));
		cancel.addEventListener('click', () => cleanup(null));
		confirm.addEventListener('click', () => cleanup(input.value.trim() || null));
		input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm.click(); });
		overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });
	});
}

export function editGiftDialog({ title = 'Edit item', nameLabel = 'Name', linkLabel = 'Link (optional)', initialName = '', initialLink = '' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal active';
    overlay.style.display = 'flex';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const header = document.createElement('div');
    header.className = 'modal-header';
    const h2 = document.createElement('h2');
    h2.textContent = title;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '×';
    header.appendChild(h2);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'modal-body';
    const nameLab = document.createElement('label');
    nameLab.textContent = nameLabel;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = initialName || '';
    nameInput.style.width = '100%';
    nameInput.style.padding = '10px';
    nameInput.style.border = '1px solid var(--color-border)';
    nameInput.style.borderRadius = '6px';

    const linkLab = document.createElement('label');
    linkLab.textContent = linkLabel;
    linkLab.style.marginTop = '10px';
    const linkInput = document.createElement('input');
    linkInput.type = 'url';
    linkInput.placeholder = 'https://example.com/product';
    linkInput.value = initialLink || '';
    linkInput.style.width = '100%';
    linkInput.style.padding = '10px';
    linkInput.style.border = '1px solid var(--color-border)';
    linkInput.style.borderRadius = '6px';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.marginTop = '12px';
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.backgroundColor = '#6b7280';
    const save = document.createElement('button');
    save.textContent = 'Save';
    actions.appendChild(cancel);
    actions.appendChild(save);

    body.appendChild(nameLab);
    body.appendChild(nameInput);
    body.appendChild(linkLab);
    body.appendChild(linkInput);
    body.appendChild(actions);

    content.appendChild(header);
    content.appendChild(body);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    function cleanup(result) {
      overlay.classList.remove('active');
      setTimeout(() => { if (!overlay.classList.contains('active')) overlay.remove(); }, 200);
      resolve(result);
    }

    closeBtn.addEventListener('click', () => cleanup(null));
    cancel.addEventListener('click', () => cleanup(null));
    save.addEventListener('click', () => {
      const name = (nameInput.value || '').trim();
      const link = (linkInput.value || '').trim();
      cleanup({ name, link });
    });
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); });
    linkInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });
  });
}
