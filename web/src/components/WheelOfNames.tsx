import { useRef, useEffect } from 'react';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

interface WheelOfNamesProps {
  names: string[];
  isSpinning: boolean;
  winner: string | null;
  onSpin?: () => void;
}

const CANVAS_SIZE = 400;
const RADIUS = 180;
const CENTER = CANVAS_SIZE / 2;

const WheelOfNames: React.FC<WheelOfNamesProps> = ({ names, isSpinning, winner, onSpin }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  const drawWheel = (ctx: CanvasRenderingContext2D, angle: number) => {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (names.length === 0) {
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#3a3f4a';
      ctx.fill();
    } else {
      const segmentAngle = (2 * Math.PI) / names.length;

      ctx.save();
      ctx.translate(CENTER, CENTER);
      ctx.rotate(angle);

      for (let i = 0; i < names.length; i++) {
        const color = i % 2 === 0 ? '#3a3f4a' : '#4d9de0';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, RADIUS, segmentAngle * i, segmentAngle * (i + 1));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        ctx.save();
        ctx.rotate(segmentAngle * (i + 0.5));
        ctx.translate(RADIUS * 0.65, 0);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#fff';
        ctx.font = '13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(names[i], 0, 0);
        ctx.restore();
      }

      ctx.restore();
    }

    // Draw pointer fixed at 12 o'clock (outside the rotation)
    ctx.save();
    ctx.translate(CENTER, 0);
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(-12, 40);
    ctx.lineTo(12, 40);
    ctx.closePath();
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawWheel(ctx, angleRef.current);
  }, [names]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (isSpinning) {
      const animate = () => {
        angleRef.current += 0.08;
        drawWheel(ctx, angleRef.current);
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [isSpinning]);

  useEffect(() => {
    if (!isSpinning && winner !== null && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const startAngle = angleRef.current;
      const startTime = performance.now();
      const duration = 1500;

      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

      const decelerate = (timestamp: number) => {
        const t = Math.min((timestamp - startTime) / duration, 1);
        angleRef.current = startAngle + easeOut(t) * Math.PI * 4;
        drawWheel(ctx, angleRef.current);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(decelerate);
        }
      };
      rafRef.current = requestAnimationFrame(decelerate);
    }
  }, [isSpinning, winner]);

  return (
    <div style={{ backgroundColor: '#282c34', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} />
      {winner !== null && (
        <Paper elevation={3} sx={{ marginTop: '16px', padding: '12px 24px', textAlign: 'center', backgroundColor: '#1f2329' }}>
          <Typography variant="h5" color="secondary">{winner} 🎉</Typography>
        </Paper>
      )}
      {onSpin && (
        <Button
          variant="contained"
          onClick={onSpin}
          disabled={isSpinning || names.length === 0}
          sx={{ marginTop: '16px' }}
        >
          Spin!
        </Button>
      )}
    </div>
  );
};

export default WheelOfNames;
