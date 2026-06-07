export class Character {
    readonly id: string;
    readonly name: string;

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    get alias(): string {
        return this.name;
    }
}
