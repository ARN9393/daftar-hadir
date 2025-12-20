declare module 'react-signature-canvas' {
  import { Component, CanvasHTMLAttributes } from 'react';

  export interface ReactSignatureCanvasProps {
    canvasProps?: CanvasHTMLAttributes<HTMLCanvasElement>;
    clearOnResize?: boolean;
    penColor?: string;
    backgroundColor?: string;
    velocityFilterWeight?: number;
    minWidth?: number;
    maxWidth?: number;
    minDistance?: number;
    dotSize?: number | (() => number);
    onEnd?: () => void;
    onBegin?: () => void;
  }

  class SignatureCanvas extends Component<ReactSignatureCanvasProps> {
    getCanvas(): HTMLCanvasElement;
    getTrimmedCanvas(): HTMLCanvasElement;
    isEmpty(): boolean;
    clear(): void;
    fromDataURL(dataURL: string, options?: { ratio?: number; width?: number; height?: number; callback?: (error?: Error) => void }): void;
    toDataURL(type?: string, encoderOptions?: number): string;
    fromData(pointGroups: any[]): void;
    toData(): any[];
    off(): void;
    on(): void;
  }

  export default SignatureCanvas;
}