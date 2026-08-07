import React, { useState } from 'react';
import { MeGroup, MeHint, MeSubPage, MeSwitchRow } from './MeSubChrome';

const Notifications: React.FC = () => {
  const [pushOn, setPushOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [vibrateOn, setVibrateOn] = useState(false);
  const [projectOn, setProjectOn] = useState(true);
  const [mentionOn, setMentionOn] = useState(true);
  const [emailOn, setEmailOn] = useState(false);

  return (
    <MeSubPage title="通知设置">
      <MeHint>系统通知</MeHint>
      <MeGroup>
        <MeSwitchRow label="推送通知" checked={pushOn} onChange={setPushOn} />
        <MeSwitchRow label="声音提醒" checked={soundOn} onChange={setSoundOn} />
        <MeSwitchRow label="震动反馈" checked={vibrateOn} onChange={setVibrateOn} />
      </MeGroup>
      <MeHint>消息类型</MeHint>
      <MeGroup>
        <MeSwitchRow label="项目动态" checked={projectOn} onChange={setProjectOn} />
        <MeSwitchRow label="@我 / 提及" checked={mentionOn} onChange={setMentionOn} />
        <MeSwitchRow label="邮件摘要" checked={emailOn} onChange={setEmailOn} />
      </MeGroup>
    </MeSubPage>
  );
};

export default Notifications;
