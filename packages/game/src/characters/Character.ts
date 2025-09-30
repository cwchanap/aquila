import { CharacterDirectory, CharacterId } from './CharacterDirectory';

export class Character {
    readonly id: CharacterId;

    constructor(id: CharacterId) {
        this.id = id;
    }

    get info() {
        return CharacterDirectory.getById(this.id);
    }

    get name(): string {
        return this.info?.name ?? this.id;
    }

    get alias(): string {
        return this.info?.alias ?? this.name;
    }
}
