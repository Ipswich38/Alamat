import ChessBoard3D from '@/components/game/ChessBoard3D';

export const metadata = {
  title: 'Alamat Chess — Heroes as Pieces',
  description: 'Filipino folklore chess — Alamat heroes fight on capture.',
};

export default function ChessPage(){
  return <ChessBoard3D />;
}
