// Vitest setup: Mock Web Audio API and HTML5 Canvas for Node/JSDOM environments

if (typeof window !== "undefined") {
  // Mock HTMLCanvasElement.getContext('2d')
  if (!HTMLCanvasElement.prototype.getContext) {
    // @ts-expect-error Mocking canvas 2d context for headless testing
    HTMLCanvasElement.prototype.getContext = (contextId: string) => {
      if (contextId === "2d") {
        return {
          fillRect: () => {},
          clearRect: () => {},
          getImageData: () => ({ data: new Array(4) }),
          putImageData: () => {},
          createImageData: () => [],
          setTransform: () => {},
          drawImage: () => {},
          save: () => {},
          fillText: () => {},
          strokeText: () => {},
          measureText: () => ({ width: 50 }),
          restore: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          stroke: () => {},
          fill: () => {},
          arc: () => {},
          roundRect: () => {},
          createLinearGradient: () => ({
            addColorStop: () => {},
          }),
          createRadialGradient: () => ({
            addColorStop: () => {},
          }),
          shadowBlur: 0,
          shadowColor: "",
          fillStyle: "",
          strokeStyle: "",
          lineWidth: 1,
          font: "",
          textAlign: "left",
          textBaseline: "top",
          canvas: { width: 800, height: 400 },
        };
      }
      return null;
    };
  }

  // Mock navigator.mediaDevices
  if (!navigator.mediaDevices) {
    // @ts-expect-error Mocking mediaDevices
    navigator.mediaDevices = {};
  }
  if (!navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia = async () => {
      return {
        getTracks: () => [
          {
            stop: () => {},
            kind: "audio",
            enabled: true,
          },
        ],
      } as unknown as MediaStream;
    };
  }
}
