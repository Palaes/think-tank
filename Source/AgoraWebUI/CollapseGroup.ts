class CollapseGroup {
	public readonly content: HTMLElement;

	private container: HTMLElement;
	private button: HTMLButtonElement;
	private name: string;

	public constructor(parent: HTMLElement, name: string) {
		this.name = name;
		this.container = document.createElement("div");
		this.container.className = "collapseGroup";
		parent.appendChild(this.container);

		this.button = document.createElement("button");
		this.button.className = "groupButton";
		this.button.innerText = name;
		this.button.addEventListener("click", () => this.toggle());
		this.container.appendChild(this.button);

		this.content = document.createElement("div");
		this.content.className = "groupContent";
		this.container.appendChild(this.content);

		this.loadState();
	}

	public expand(): void {
		this.setState(false);
	}

	public setUnread(unread: boolean): void {
		this.button.classList.toggle("unread", unread);
	}

	public moveToEnd(): void {
		this.container.parentElement.appendChild(this.container);
	}

	private toggle(): void {
		this.setState(!this.isCollapsed());
	}

	private isCollapsed(): boolean {
		return this.container.classList.contains("collapsed");
	}

	private setState(collapsed: boolean): void {
		if (collapsed) {
			this.container.classList.add("collapsed");
			localStorage.setItem(this.key(), "1");
		} else {
			this.container.classList.remove("collapsed");
			localStorage.setItem(this.key(), "0");
		}
	}

	private loadState(): void {
		// groups start collapsed until the stored state opens them
		if (localStorage.getItem(this.key()) == "0") {
			this.container.classList.remove("collapsed");
		} else {
			this.container.classList.add("collapsed");
		}
	}

	private key(): string {
		return `collapsed.${this.name}`;
	}
}
