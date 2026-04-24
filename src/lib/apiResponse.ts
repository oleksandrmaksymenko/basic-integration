import {NextResponse} from 'next/server';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({data}, {status});
}

export function err(message: string, status = 500) {
  return NextResponse.json({message}, {status});
}

export function catchErr(e: unknown) {
  const message = e instanceof Error ? e.message : 'Internal server error';
  return err(message, 500);
}
