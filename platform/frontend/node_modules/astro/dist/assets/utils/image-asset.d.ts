import type { ImageMetadata } from '../types.js';
export declare function createImageAsset<T extends Omit<ImageMetadata, 'fsPath'>>(metadata: T, fsPath: string, track: boolean): T & ImageMetadata;
export declare function getUntrackedImage<T>(image: T): T;
