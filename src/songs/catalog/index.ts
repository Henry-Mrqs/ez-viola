import { SongSchema, validateSongSchema } from "../song-schema";
import openStringsJson from "./open-strings.json";
import fourChordsJson from "./four-chords.json";
import horseWithNoNameJson from "./horse-with-no-name.json";
import knockinOnHeavensDoorJson from "./knockin-on-heavens-door.json";
import tempoPerdidoJson from "./tempo-perdido.json";

export const CATALOG_SONGS: SongSchema[] = [
  validateSongSchema(openStringsJson),
  validateSongSchema(fourChordsJson),
  validateSongSchema(horseWithNoNameJson),
  validateSongSchema(knockinOnHeavensDoorJson),
  validateSongSchema(tempoPerdidoJson),
];

export function getSongById(id: string): SongSchema | undefined {
  return CATALOG_SONGS.find((song) => song.id === id);
}
