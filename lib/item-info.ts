import type { Item } from './game';
export const ITEM_INFO: Record<
  Item,
  { name: string; description: string; icon: string }
> = {
  oracle: {
    name: 'お告げ',
    description: '相手のランダムな3枚にドクロがあるか、自分だけ確認。カード番号と有無を履歴にも記録。残り2枚以下なら全てが対象。',
    icon: 'oracle',
  },
  substitute: {
    name: '身代わり',
    description: '使用したターンにドクロを引くと、バーストを防ぎ、ラウンド獲得枚数を2枚減らしてターン終了（最低0枚）。1ラウンド1回。ガード・カウンターとの併用不可。',
    icon: 'swap',
  },
  trap: {
    name: '終了トラップ',
    description:
      '自分のカード1枚に設置。引いた人は得点獲得後ただちにターン終了。ドクロならバースト判定を優先。',
    icon: 'trap',
  },
  dud: {
    name: '不発弾',
    description: '自分の1枚を偽のドクロに変更。引いてもバーストせず獲得枚数も増えません。透視・お告げにはドクロとして映ります。',
    icon: 'trap',
  },
  counter: {
    name: 'ランダムガード',
    description: '使用ターン中、ドクロを引くと自分とセーフの2択ルーレットを表示。自分が選ばれるとバーストし、セーフなら誰もバーストせず、ターンを続行。不発弾では発動しません。',
    icon: 'dice',
  },
  reposition: {
    name: '再配置',
    description: '自分の手札をドラッグして並べ替え、確定します。並べ替えず確定しても使用完了。相手の透視情報は解除されます。',
    icon: 'shuffle',
  },
  peek: {
    name: '透視',
    description: '相手のカード1枚の天使・ドクロとトラップを、自分だけ確認できます。',
    icon: 'eye',
  },
  shield: {
    name: 'ドクロガード',
    description: '使用したターンだけ有効。ドクロを防ぎ、このターンの獲得枚数を半分にしてターン終了。不発弾を引くとガードが消滅します。1ラウンド1回。身代わり・カウンターとの併用不可。',
    icon: 'shield',
  },
  double: {
    name: '得点倍化',
    description: '最初の1枚を引く前に使用。その1枚が天使なら獲得枚数を2倍にします。1ラウンド1回。他の出現対象アイテムと同じ確率で出現します。',
    icon: 'double',
  },
  recycle: {
    name: 'リサイクル',
    description:
      'このアイテムと別のアイテム1個を消費し、犠牲にしたものと異なるアイテムを取得。',
    icon: 'recycle',
  },
  nominate: {
    name: '指名変更',
    description: 'このターンにカードを引く相手を変更します。バースト済み・安全確定のプレイヤーは選べません。',
    icon: 'point',
  },
  blessing: {
    name: '天使の加護',
    description: '所持中にドクロを引くと自動で発動し、バーストを1回防ぎます。得点減少やターン終了はありません。発動後に消費されます。出現率1%（100回に1回）。',
    icon: 'blessing',
  },
};
