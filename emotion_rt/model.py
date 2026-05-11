from __future__ import annotations

import torch
import torch.nn as nn


def depthwise_conv(i: int, o: int, kernel_size: int, stride: int = 1, padding: int = 0) -> nn.Conv2d:
    return nn.Conv2d(i, o, kernel_size, stride, padding, bias=False, groups=i)


def channel_shuffle(x: torch.Tensor, groups: int) -> torch.Tensor:
    batch_size, num_channels, height, width = x.size()
    channels_per_group = num_channels // groups
    x = x.view(batch_size, groups, channels_per_group, height, width)
    x = torch.transpose(x, 1, 2).contiguous()
    return x.view(batch_size, -1, height, width)


class LocalFeatureExtractor(nn.Module):
    def __init__(self, inplanes: int, planes: int) -> None:
        super().__init__()
        norm_layer = nn.BatchNorm2d
        self.relu = nn.ReLU(inplace=True)
        self.conv1_1 = depthwise_conv(inplanes, planes, kernel_size=3, stride=2, padding=1)
        self.bn1_1 = norm_layer(planes)
        self.conv1_2 = depthwise_conv(planes, planes, kernel_size=3, stride=1, padding=1)
        self.bn1_2 = norm_layer(planes)

        self.conv2_1 = depthwise_conv(inplanes, planes, kernel_size=3, stride=2, padding=1)
        self.bn2_1 = norm_layer(planes)
        self.conv2_2 = depthwise_conv(planes, planes, kernel_size=3, stride=1, padding=1)
        self.bn2_2 = norm_layer(planes)

        self.conv3_1 = depthwise_conv(inplanes, planes, kernel_size=3, stride=2, padding=1)
        self.bn3_1 = norm_layer(planes)
        self.conv3_2 = depthwise_conv(planes, planes, kernel_size=3, stride=1, padding=1)
        self.bn3_2 = norm_layer(planes)

        self.conv4_1 = depthwise_conv(inplanes, planes, kernel_size=3, stride=2, padding=1)
        self.bn4_1 = norm_layer(planes)
        self.conv4_2 = depthwise_conv(planes, planes, kernel_size=3, stride=1, padding=1)
        self.bn4_2 = norm_layer(planes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        patch_11 = x[:, :, 0:28, 0:28]
        patch_21 = x[:, :, 28:56, 0:28]
        patch_12 = x[:, :, 0:28, 28:56]
        patch_22 = x[:, :, 28:56, 28:56]

        out_1 = self.relu(self.bn1_1(self.conv1_1(patch_11)))
        out_1 = self.relu(self.bn1_2(self.conv1_2(out_1)))

        out_2 = self.relu(self.bn2_1(self.conv2_1(patch_21)))
        out_2 = self.relu(self.bn2_2(self.conv2_2(out_2)))

        out_3 = self.relu(self.bn3_1(self.conv3_1(patch_12)))
        out_3 = self.relu(self.bn3_2(self.conv3_2(out_3)))

        out_4 = self.relu(self.bn4_1(self.conv4_1(patch_22)))
        out_4 = self.relu(self.bn4_2(self.conv4_2(out_4)))

        out1 = torch.cat([out_1, out_2], dim=2)
        out2 = torch.cat([out_3, out_4], dim=2)
        return torch.cat([out1, out2], dim=3)


class ChannelGate(nn.Module):
    def __init__(self, channels: int, reduction: int = 16) -> None:
        super().__init__()
        hidden = max(4, channels // reduction)
        self.gate_c_fc_0 = nn.Linear(channels, hidden)
        self.gate_c_bn_1 = nn.BatchNorm1d(hidden)
        self.gate_c_fc_final = nn.Linear(hidden, channels)
        self.relu = nn.ReLU(inplace=True)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        pooled = x.mean(dim=(2, 3))
        gate = self.gate_c_fc_0(pooled)
        gate = self.gate_c_bn_1(gate)
        gate = self.relu(gate)
        gate = self.gate_c_fc_final(gate)
        gate = self.sigmoid(gate).unsqueeze(-1).unsqueeze(-1)
        return x * gate


class ChannelAttention(nn.Module):
    def __init__(self, channels: int) -> None:
        super().__init__()
        self.gate_c = ChannelGate(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.gate_c(x)


class SpatialGate(nn.Module):
    def __init__(self, channels: int, reduction: int = 16) -> None:
        super().__init__()
        hidden = max(4, channels // reduction)
        self.gate_s_conv_reduce0 = nn.Conv2d(channels, hidden, kernel_size=1, bias=True)
        self.gate_s_bn_reduce0 = nn.BatchNorm2d(hidden)
        self.gate_s_conv_di_0 = nn.Conv2d(hidden, hidden, kernel_size=3, padding=1, bias=True)
        self.gate_s_bn_di_0 = nn.BatchNorm2d(hidden)
        self.gate_s_conv_di_1 = nn.Conv2d(hidden, hidden, kernel_size=3, padding=1, bias=True)
        self.gate_s_bn_di_1 = nn.BatchNorm2d(hidden)
        self.gate_s_conv_final = nn.Conv2d(hidden, 1, kernel_size=1, bias=True)
        self.relu = nn.ReLU(inplace=True)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        gate = self.relu(self.gate_s_bn_reduce0(self.gate_s_conv_reduce0(x)))
        gate = self.relu(self.gate_s_bn_di_0(self.gate_s_conv_di_0(gate)))
        gate = self.relu(self.gate_s_bn_di_1(self.gate_s_conv_di_1(gate)))
        gate = self.sigmoid(self.gate_s_conv_final(gate))
        return x * gate


class SpatialAttention(nn.Module):
    def __init__(self, channels: int) -> None:
        super().__init__()
        self.gate_s = SpatialGate(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.gate_s(x)


class Modulator(nn.Module):
    def __init__(self, channels: int) -> None:
        super().__init__()
        self.channel_att = ChannelAttention(channels)
        self.spatial_att = SpatialAttention(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.channel_att(x)
        x = self.spatial_att(x)
        return x


class InvertedResidual(nn.Module):
    def __init__(self, inp: int, oup: int, stride: int) -> None:
        super().__init__()
        if not (1 <= stride <= 3):
            raise ValueError("illegal stride value")

        self.stride = stride
        branch_features = oup // 2
        assert (self.stride != 1) or (inp == branch_features << 1)

        if self.stride > 1:
            self.branch1 = nn.Sequential(
                depthwise_conv(inp, inp, kernel_size=3, stride=self.stride, padding=1),
                nn.BatchNorm2d(inp),
                nn.Conv2d(inp, branch_features, kernel_size=1, stride=1, padding=0, bias=False),
                nn.BatchNorm2d(branch_features),
                nn.ReLU(inplace=True),
            )
        else:
            self.branch1 = None

        self.branch2 = nn.Sequential(
            nn.Conv2d(inp if self.stride > 1 else branch_features, branch_features, kernel_size=1, stride=1, padding=0, bias=False),
            nn.BatchNorm2d(branch_features),
            nn.ReLU(inplace=True),
            depthwise_conv(branch_features, branch_features, kernel_size=3, stride=self.stride, padding=1),
            nn.BatchNorm2d(branch_features),
            nn.Conv2d(branch_features, branch_features, kernel_size=1, stride=1, padding=0, bias=False),
            nn.BatchNorm2d(branch_features),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if self.stride == 1:
            x1, x2 = x.chunk(2, dim=1)
            out = torch.cat((x1, self.branch2(x2)), dim=1)
        else:
            assert self.branch1 is not None
            out = torch.cat((self.branch1(x), self.branch2(x)), dim=1)
        return channel_shuffle(out, 2)


class EfficientFace(nn.Module):
    def __init__(self, stages_repeats: list[int], stages_out_channels: list[int], num_classes: int = 7) -> None:
        super().__init__()
        if len(stages_repeats) != 3:
            raise ValueError("expected stages_repeats as list of 3 positive ints")
        if len(stages_out_channels) != 5:
            raise ValueError("expected stages_out_channels as list of 5 positive ints")

        self._stage_out_channels = stages_out_channels
        input_channels = 3
        output_channels = self._stage_out_channels[0]
        self.conv1 = nn.Sequential(
            nn.Conv2d(input_channels, output_channels, 3, 2, 1, bias=False),
            nn.BatchNorm2d(output_channels),
            nn.ReLU(inplace=True),
        )
        input_channels = output_channels
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)

        stage_names = ["stage2", "stage3", "stage4"]
        for name, repeats, output_channels in zip(stage_names, stages_repeats, self._stage_out_channels[1:]):
            seq = [InvertedResidual(input_channels, output_channels, 2)]
            for _ in range(repeats - 1):
                seq.append(InvertedResidual(output_channels, output_channels, 1))
            setattr(self, name, nn.Sequential(*seq))
            input_channels = output_channels

        self.local = LocalFeatureExtractor(29, 116)
        self.modulator = Modulator(116)

        output_channels = self._stage_out_channels[-1]
        self.conv5 = nn.Sequential(
            nn.Conv2d(input_channels, output_channels, 1, 1, 0, bias=False),
            nn.BatchNorm2d(output_channels),
            nn.ReLU(inplace=True),
        )
        self.fc = nn.Linear(output_channels, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.conv1(x)
        x = self.maxpool(x)
        x = self.modulator(self.stage2(x)) + self.local(x)
        x = self.stage3(x)
        x = self.stage4(x)
        x = self.conv5(x)
        x = x.mean([2, 3])
        return self.fc(x)


def efficient_face(num_classes: int = 7) -> EfficientFace:
    return EfficientFace([4, 8, 4], [29, 116, 232, 464, 1024], num_classes=num_classes)
