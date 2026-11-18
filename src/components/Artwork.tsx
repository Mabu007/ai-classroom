import type {CSSProperties} from 'react';
import type {Challenge} from '../../shared/catalog.mjs';
export default function Artwork({challenge,hero=false}:{challenge:Challenge;hero?:boolean}){
 return <div className={'sg-art sg-art-'+challenge.art+(hero?' sg-art-hero':'')}
  style={{'--accent':challenge.accent} as CSSProperties} aria-hidden="true">
  <div className="sg-art-texture"/><div className="sg-art-halo"/>
  <div className="sg-art-silhouette"><span className="sg-head"/><span className="sg-body"/></div>
  <span className="sg-art-symbol">{challenge.icon}</span>
  <span className="sg-art-monogram">{challenge.title.split(' ').slice(0,2).map(w=>w[0]).join('')}</span>
  <div className="sg-art-shadow"/>
 </div>;
}
