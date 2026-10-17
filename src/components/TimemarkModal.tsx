'use client';

import React from 'react';
import TtbMediaModal, { TtbMediaModalProps } from './TtbMediaModal';

export type TimemarkModalProps = TtbMediaModalProps;

export default function TimemarkModal(props: TtbMediaModalProps) {
  return <TtbMediaModal {...props} />;
}
